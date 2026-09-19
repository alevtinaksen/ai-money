import io
import os
import re
import sys
import json
import logging
import tempfile
import subprocess
from typing import List, Optional, Dict, Any
from app.schemas.finance import AIParsedTransaction
from app.services.ai_parser import AIParserService

logger = logging.getLogger(__name__)

SWIFT_OCR_SCRIPT = """
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else { exit(1) }
let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path),
      let tiffData = image.tiffRepresentation,
      let ciImage = CIImage(data: tiffData) else { exit(1) }

let request = VNRecognizeTextRequest()
request.recognitionLanguages = ["ru-RU", "en-US"]
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
try? handler.perform([request])

struct Obs: Codable {
    let y: Double
    let x: Double
    let text: String
}

var list: [Obs] = []
if let results = request.results {
    for obs in results {
        if let top = obs.topCandidates(1).first {
            list.append(Obs(y: obs.boundingBox.origin.y, x: obs.boundingBox.origin.x, text: top.string))
        }
    }
}
let data = try! JSONEncoder().encode(list)
print(String(data: data, encoding: .utf8)!)
"""

class OCRService:
    @staticmethod
    def extract_observations(image_bytes: bytes) -> List[Dict[str, Any]]:
        """Extracts text observations with (y, x, text) coordinates from image bytes."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            # 1. macOS native Apple Vision OCR (fastest & most accurate)
            if sys.platform == "darwin":
                try:
                    res = subprocess.run(
                        ["swift", "-e", SWIFT_OCR_SCRIPT, tmp_path],
                        capture_output=True,
                        text=True,
                        timeout=15
                    )
                    if res.returncode == 0 and res.stdout.strip():
                        return json.loads(res.stdout.strip())
                except Exception as e:
                    logger.warning(f"macOS Vision OCR error: {e}")

            # 2. Linux / PyTesseract fallback
            try:
                from PIL import Image
                import pytesseract
                img = Image.open(tmp_path)
                data = pytesseract.image_to_data(img, lang="rus+eng", output_type=pytesseract.Output.DICT)
                obs = []
                img_h = float(img.height or 1)
                img_w = float(img.width or 1)
                for i in range(len(data["text"])):
                    txt = data["text"][i].strip()
                    if txt:
                        # Normalize to 0..1 coordinates matching Vision (Y from bottom up)
                        top = data["top"][i]
                        left = data["left"][i]
                        y = 1.0 - (float(top) / img_h)
                        x = float(left) / img_w
                        obs.append({"y": y, "x": x, "text": txt})
                if obs:
                    return obs
            except Exception as e:
                logger.warning(f"PyTesseract fallback error: {e}")

        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

        return []

    @staticmethod
    def cluster_lines(observations: List[Dict[str, Any]], epsilon: float = 0.016) -> List[Dict[str, Any]]:
        """Clusters spatial observations into horizontal text lines sorted top-to-bottom."""
        clusters: List[Dict[str, Any]] = []
        for obs in sorted(observations, key=lambda o: -o["y"]):
            y = obs["y"]
            x = obs["x"]
            text = obs["text"].strip()
            if not text:
                continue

            matched = False
            for cl in clusters:
                if abs(cl["y"] - y) <= epsilon:
                    cl["items"].append((x, text))
                    matched = True
                    break
            if not matched:
                clusters.append({"y": y, "items": [(x, text)]})

        for cl in clusters:
            cl["items"].sort(key=lambda it: it[0])
            cl["line_text"] = " ".join(it[1] for it in cl["items"])

        return clusters

    @staticmethod
    def parse_transactions(
        image_bytes: bytes,
        caption: str = "",
        account_names: List[str] = None,
        category_names: List[str] = None
    ) -> List[AIParsedTransaction]:
        """
        Extracts financial transactions from a bank app screenshot or receipt.
        Combines spatial OCR geometry with contextual caption instructions.
        """
        account_names = account_names or []
        category_names = category_names or []

        observations = OCRService.extract_observations(image_bytes)
        if not observations:
            return []

        clusters = OCRService.cluster_lines(observations)
        all_text = " ".join(c["line_text"] for c in clusters)
        combined_context = f"{caption} {all_text}".strip()

        # Determine target account
        target_account = AIParserService.match_account_name(caption, account_names)
        if not target_account:
            target_account = AIParserService.match_account_name(all_text, account_names)
        if not target_account and account_names:
            target_account = account_names[0]

        # Check if caption specifies number of purchases (e.g. "спиши эти 3 покупки")
        limit_match = re.search(r"(\d+)\s+покуп", caption.lower())
        limit_count = int(limit_match.group(1)) if limit_match else None

        # Ignore non-transaction lines like total cards, limits, banners, day headers
        skip_line_phrases = [
            "сегодня", "вчера", "доступна рассрочка", "для", "операций на сумму", "траты", "доходы",
            "перевод между", "баланс", "остаток", "лимит"
        ]

        found_transactions: List[AIParsedTransaction] = []

        # Find transaction rows (where an expense amount like -498 ₽ or -109,99 ₽ is present)
        for cl in clusters:
            line_str = cl["line_text"]
            line_lower = line_str.lower()

            if any(phrase in line_lower for phrase in skip_line_phrases):
                continue

            # Check for amount with minus or currency (e.g. "-498 ₽", "-109,99 ₽", "498.00 ₽")
            amt_match = re.search(r"[−\-]\s*(\d+(?:[\s\xa0]\d+)*(?:[.,]\d{1,2})?)\s*₽?", line_str)
            if not amt_match:
                continue

            amt_raw = amt_match.group(1).replace(" ", "").replace("\xa0", "").replace(",", ".")
            try:
                amount = float(amt_raw)
            except ValueError:
                continue

            if amount <= 0:
                continue

            # Extract merchant/title from items on the line that are to the left of the amount
            merchant_candidates = []
            for item_x, item_text in cl["items"]:
                cleaned_item = item_text.strip()
                if not cleaned_item:
                    continue
                # Skip amount itself and small author badges like "+4) Алевтина К." or "•1 Владислав С."
                if re.match(r"^[−\-+]?\s*\d+", cleaned_item) or "₽" in cleaned_item:
                    continue
                if re.search(r"алевтина|владислав|влада|сергеев", cleaned_item.lower()):
                    continue
                if cleaned_item.lower() in ["фастфуд", "супермаркеты", "кафе", "рестораны", "покупки"]:
                    continue
                merchant_candidates.append(cleaned_item)

            merchant_name = " ".join(merchant_candidates).strip()
            merchant_name = re.sub(r"^(?:фастфуд|супермаркеты|супермаркет|кафе|рестораны)\s+", "", merchant_name, flags=re.I).strip()
            if not merchant_name:
                # If merchant wasn't on the same line, check line text before amount
                part_before = line_str[:amt_match.start()].strip()
                part_before = re.sub(r"[+•]\d+.*", "", part_before).strip()
                part_before = re.sub(r"^(?:фастфуд|супермаркеты|супермаркет|кафе|рестораны)\s+", "", part_before, flags=re.I).strip()
                merchant_name = part_before or "Покупка"

            # Determine category based on merchant and line keywords
            matched_cat = "Еда"
            cat_lower = f"{merchant_name} {line_str}".lower()

            if any(w in cat_lower for w in ["вкусно", "точка", "макдоналдс", "бургер", "додо", "food", "фастфуд", "кафе", "теремок", "шоколадниц", "кофе", "kfc", "ростикс"]):
                matched_cat = "Еда"
            elif any(w in cat_lower for w in ["о'кей", "окей", "супермаркет", "пятерочк", "перекресток", "магнит", "вкусвилл", "самокат", "лента", "ашан"]):
                matched_cat = "Еда"
            elif any(w in cat_lower for w in ["аптек", "лекарств", "клиник", "врач", "здоров"]):
                matched_cat = "Здоровье"
            elif any(w in cat_lower for w in ["такси", "каршеринг", "метро", "транспорт", "бензин"]):
                matched_cat = "Транспорт"
            elif any(w in cat_lower for w in ["кино", "игры", "развлечен"]):
                matched_cat = "Развлечения"
            elif any(w in cat_lower for w in ["одежд", "zara", "lime", "магазин", "wildberries", "ozon"]):
                matched_cat = "Покупки"

            found_transactions.append(
                AIParsedTransaction(
                    amount=amount,
                    type="expense",
                    category_name=matched_cat,
                    account_name=target_account,
                    to_account_name=None,
                    note=merchant_name
                )
            )

        # Apply limit if user specified number of purchases (e.g. "эти 3 покупки")
        if limit_count and limit_count > 0:
            found_transactions = found_transactions[:limit_count]

        return found_transactions
