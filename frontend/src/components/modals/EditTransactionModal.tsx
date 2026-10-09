import { moneyInput, currencyLabel } from '../../utils/money';
import React, { useState } from 'react';
import { TransactionEditor } from '../design/TransactionEditor';
import { CategorySelection } from '../design/CategorySelection';
import { categorySelection } from '../../utils/categorySelection';
import { AccountSelectSheet } from './AccountSelectSheet';
import { ConfirmPanel } from '../design/Support';
import { Transaction, Account, Category } from '../../types';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSave: (updated: {
    id: string;
    amount: number;
    account_id: string;
    to_account_id?: string;
    category_id?: string;
    type: 'expense' | 'income' | 'transfer';
    note?: string | null;
    created_at?: string;
  }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export interface CategoryCatalogItem {
  name: string;
  icon: string;
  type: 'expense' | 'income' | 'transfer';
  subcategories: string[];
}

export const CATEGORIES_CATALOG: CategoryCatalogItem[] = [
  {
    name: 'Еда',
    icon: '🍔',
    type: 'expense',
    subcategories: ['Супермаркет', 'Кафе', 'Самокат', 'Кофе', 'НаЛанч'],
  },
  {
    name: 'Транспорт',
    icon: '🚗',
    type: 'expense',
    subcategories: ['Такси', 'Каршеринг', 'Общественный', 'Поезд', 'Метро'],
  },
  {
    name: 'Покупки',
    icon: '🛍️',
    type: 'expense',
    subcategories: ['Дом', 'Бытовая химия', 'Одежда', 'Электроника', 'Товары для хобби'],
  },
  {
    name: 'Развлечения',
    icon: '🎬',
    type: 'expense',
    subcategories: ['Кино', 'Игры', 'Вечеринки'],
  },
  {
    name: 'Здоровье',
    icon: '💊',
    type: 'expense',
    subcategories: ['Лекарства', 'Врачи'],
  },
  {
    name: 'Жилье',
    icon: '🏠',
    type: 'expense',
    subcategories: ['Аренда', 'ЖКХ', 'Ремонт'],
  },
  {
    name: 'Личное',
    icon: '👤',
    type: 'expense',
    subcategories: ['Внешний вид', 'Привычки', 'Спорт'],
  },
  {
    name: 'Путешествия',
    icon: '✈️',
    type: 'expense',
    subcategories: [],
  },
  {
    name: 'Кот',
    icon: '🐱',
    type: 'expense',
    subcategories: ['Корм для кота', 'Здоровье кота'],
  },
  {
    name: 'Машина',
    icon: '🚘',
    type: 'expense',
    subcategories: ['Бензин', 'ТО авто', 'Парковка', 'Кредит за авто'],
  },
  {
    name: 'Подписки',
    icon: '💿',
    type: 'expense',
    subcategories: ['Музыка', 'Кинотеатры', 'Облако'],
  },
  {
    name: 'Подарки',
    icon: '🎁',
    type: 'expense',
    subcategories: ['Друзьям', 'Семье'],
  },
  {
    name: 'Накопления',
    icon: '🏦',
    type: 'expense',
    subcategories: ['Вклад', 'Копилка'],
  },
  {
    name: 'Переводы',
    icon: '💸',
    type: 'transfer',
    subcategories: ['Владу', 'Родителям', 'Себе на карту'],
  },
  {
    name: 'Зарплата',
    icon: '💰',
    type: 'income',
    subcategories: ['Основная', 'Аванс', 'Премия', 'Кешбэк'],
  },
  {
    name: 'Инвестиции',
    icon: '📈',
    type: 'income',
    subcategories: ['Дивиденды', 'Купоны', 'Проценты'],
  },
];

export function evaluateMathSum(expr: string): number {
  try {
    const parts = expr.replace(/\s+/g, '').split('+');
    const cents = parts.reduce((sum, part) => sum + BigInt(moneyInput(part).replace('.', '')), 0n);
    if (cents > 99999999999999n) return 0;
    return Number(cents) / 100;
  } catch { return 0; }
}

export const SUBCATEGORY_ICONS: Record<string, string> = {
  // Еда
  'Самокат': '🛴',
  'Кафе': '🍽️',
  'Кофе': '☕',
  'НаЛанч': '🍱',
  'Супермаркет': '🛒',

  // Транспорт & Машина
  'Такси': '🚕',
  'Каршеринг': '🚙',
  'Общественный': '🚌',
  'Поезд': '🚆',
  'Бензин': '⛽',
  'ТО авто': '🔧',
  'Парковка': '🅿️',
  'Кредит за авто': '📑',

  // Покупки
  'Дом': '🏡',
  'Товары для дома': '🏠',
  'Одежда': '👗',
  'Электроника': '💻',
  'Бытовая химия': '🧼',
  'Товары для хобби': '🎨',

  // Развлечения
  'Кино': '🍿',
  'Игры': '🎮',
  'Вечеринки': '🎉',

  // Здоровье
  'Лекарства': '💊',
  'Врачи': '🩺',
  'Психотерапевт': '🧠',

  // Жилье
  'Аренда': '🔑',
  'ЖКХ': '💡',
  'Ремонт': '🔨',

  // Личное & Кот
  'Внешний вид': '💄',
  'Привычки': '🧘',
  'Спорт': '🏃',
  'Корм для кота': '🐟',
  'Здоровье кота': '🐾',

  // Путешествия
  'Отели': '🏨',
  'Билеты': '🎫',
  'Экскурсии': '🗺️',

  // Подписки
  'Музыка': '🎵',
  'Кинотеатры': '🎬',
  'Облако': '☁️',

  // Подарки & Накопления & Доходы
  'Друзьям': '🎁',
  'Семье': '👨‍👩‍👧',
  'Вклад': '🏦',
  'Копилка': '🪙',
  'Владу': '💸',
  'Родителям': '💸',
  'Себе на карту': '💳',
  'Основная': '💰',
  'Аванс': '💵',
  'Премия': '🏆',
  'Кешбэк': '🪙',
};

export interface ResolvedCategoryInfo {
  mainCategory: string;
  subcategory: string | null;
  displayTitle: string;
  icon: string;
}

export const SUBCATEGORY_KEYWORDS_MAP: Record<string, { main: string; sub: string }> = {
  // Еда -> Супермаркет
  "о'кей": { main: 'Еда', sub: 'Супермаркет' },
  "окей": { main: 'Еда', sub: 'Супермаркет' },
  "супермаркет": { main: 'Еда', sub: 'Супермаркет' },
  "супермаркеты": { main: 'Еда', sub: 'Супермаркет' },
  "пятерочк": { main: 'Еда', sub: 'Супермаркет' },
  "пятерочка": { main: 'Еда', sub: 'Супермаркет' },
  "пятёрочк": { main: 'Еда', sub: 'Супермаркет' },
  "пятёрочка": { main: 'Еда', sub: 'Супермаркет' },
  "перекресток": { main: 'Еда', sub: 'Супермаркет' },
  "перекрёсток": { main: 'Еда', sub: 'Супермаркет' },
  "магнит": { main: 'Еда', sub: 'Супермаркет' },
  "вкусвилл": { main: 'Еда', sub: 'Супермаркет' },
  "лента": { main: 'Еда', sub: 'Супермаркет' },
  "ашан": { main: 'Еда', sub: 'Супермаркет' },
  "дикси": { main: 'Еда', sub: 'Супермаркет' },
  "spar": { main: 'Еда', sub: 'Супермаркет' },
  "спар": { main: 'Еда', sub: 'Супермаркет' },
  "чижик": { main: 'Еда', sub: 'Супермаркет' },
  "верный": { main: 'Еда', sub: 'Супермаркет' },
  "ярче": { main: 'Еда', sub: 'Супермаркет' },
  "магнолия": { main: 'Еда', sub: 'Супермаркет' },
  "азбука вкуса": { main: 'Еда', sub: 'Супермаркет' },
  "глобус": { main: 'Еда', sub: 'Супермаркет' },
  "метро": { main: 'Еда', sub: 'Супермаркет' },
  "продукты": { main: 'Еда', sub: 'Супермаркет' },
  "магазин продуктов": { main: 'Еда', sub: 'Супермаркет' },

  // Еда -> Кафе
  "вкусно": { main: 'Еда', sub: 'Кафе' },
  "food factory": { main: 'Еда', sub: 'Кафе' },
  "макдоналдс": { main: 'Еда', sub: 'Кафе' },
  "бургер": { main: 'Еда', sub: 'Кафе' },
  "теремок": { main: 'Еда', sub: 'Кафе' },
  "kfc": { main: 'Еда', sub: 'Кафе' },
  "ростикс": { main: 'Еда', sub: 'Кафе' },
  "додо": { main: 'Еда', sub: 'Кафе' },
  "шоколадниц": { main: 'Еда', sub: 'Кафе' },
  "столов": { main: 'Еда', sub: 'Кафе' },
  "пекарн": { main: 'Еда', sub: 'Кафе' },
  "булочн": { main: 'Еда', sub: 'Кафе' },
  "кафе": { main: 'Еда', sub: 'Кафе' },
  "ресторан": { main: 'Еда', sub: 'Кафе' },
  "шаверм": { main: 'Еда', sub: 'Кафе' },
  "шаурм": { main: 'Еда', sub: 'Кафе' },
  "хинкал": { main: 'Еда', sub: 'Кафе' },
  "пицц": { main: 'Еда', sub: 'Кафе' },
  "суши": { main: 'Еда', sub: 'Кафе' },

  // Еда -> Кофе
  "кофе": { main: 'Еда', sub: 'Кофе' },
  "кофейн": { main: 'Еда', sub: 'Кофе' },
  "starbucks": { main: 'Еда', sub: 'Кофе' },
  "surf": { main: 'Еда', sub: 'Кофе' },
  "капучино": { main: 'Еда', sub: 'Кофе' },
  "латте": { main: 'Еда', sub: 'Кофе' },
  "дринкит": { main: 'Еда', sub: 'Кофе' },

  // Еда -> Самокат
  "самокат": { main: 'Еда', sub: 'Самокат' },
  "samokat": { main: 'Еда', sub: 'Самокат' },

  // Еда -> НаЛанч
  "наланч": { main: 'Еда', sub: 'НаЛанч' },
  "на ланч": { main: 'Еда', sub: 'НаЛанч' },

  // Транспорт -> Такси
  "такси": { main: 'Транспорт', sub: 'Такси' },
  "яндекс go": { main: 'Транспорт', sub: 'Такси' },
  "яндекс такси": { main: 'Транспорт', sub: 'Такси' },
  "яндекс.такси": { main: 'Транспорт', sub: 'Такси' },
  "uber": { main: 'Транспорт', sub: 'Такси' },
  "убер": { main: 'Транспорт', sub: 'Такси' },
  "ситимобил": { main: 'Транспорт', sub: 'Такси' },

  // Транспорт -> Каршеринг
  "каршеринг": { main: 'Транспорт', sub: 'Каршеринг' },
  "делимобиль": { main: 'Транспорт', sub: 'Каршеринг' },
  "ситидрайв": { main: 'Транспорт', sub: 'Каршеринг' },
  "яндекс драйв": { main: 'Транспорт', sub: 'Каршеринг' },

  // Машина -> ТО авто
  "видеорегистратор": { main: 'Машина', sub: 'ТО авто' },
  "тск сигнал": { main: 'Машина', sub: 'ТО авто' },
  "тск": { main: 'Машина', sub: 'ТО авто' },
  "сигнал": { main: 'Машина', sub: 'ТО авто' },
  "автотовары": { main: 'Машина', sub: 'ТО авто' },
  "автозапчасти": { main: 'Машина', sub: 'ТО авто' },
  "запчасти": { main: 'Машина', sub: 'ТО авто' },
  "детали": { main: 'Машина', sub: 'ТО авто' },
  "автосервис": { main: 'Машина', sub: 'ТО авто' },
  "сервис авто": { main: 'Машина', sub: 'ТО авто' },
  "ремонт авто": { main: 'Машина', sub: 'ТО авто' },
  "техосмотр": { main: 'Машина', sub: 'ТО авто' },
  "то авто": { main: 'Машина', sub: 'ТО авто' },
  "шиномонтаж": { main: 'Машина', sub: 'ТО авто' },
  "колеса": { main: 'Машина', sub: 'ТО авто' },
  "шины": { main: 'Машина', sub: 'ТО авто' },
  "резина": { main: 'Машина', sub: 'ТО авто' },
  "мойка": { main: 'Машина', sub: 'ТО авто' },
  "автомойка": { main: 'Машина', sub: 'ТО авто' },
  "мойка авто": { main: 'Машина', sub: 'ТО авто' },
  "автомасло": { main: 'Машина', sub: 'ТО авто' },
  "масло": { main: 'Машина', sub: 'ТО авто' },
  "омывайк": { main: 'Машина', sub: 'ТО авто' },
  "незамерзайк": { main: 'Машина', sub: 'ТО авто' },
  "аккумулятор": { main: 'Машина', sub: 'ТО авто' },
  "аксессуары для авто": { main: 'Машина', sub: 'ТО авто' },

  // Машина -> Бензин
  "бензин": { main: 'Машина', sub: 'Бензин' },
  "азс": { main: 'Машина', sub: 'Бензин' },
  "заправка": { main: 'Машина', sub: 'Бензин' },
  "заправк": { main: 'Машина', sub: 'Бензин' },
  "топливо": { main: 'Машина', sub: 'Бензин' },
  "дизель": { main: 'Машина', sub: 'Бензин' },
  "лукойл": { main: 'Машина', sub: 'Бензин' },
  "lukoil": { main: 'Машина', sub: 'Бензин' },
  "газпромнефть": { main: 'Машина', sub: 'Бензин' },
  "газпром": { main: 'Машина', sub: 'Бензин' },
  "роснефть": { main: 'Машина', sub: 'Бензин' },
  "татнефть": { main: 'Машина', sub: 'Бензин' },
  "тебойл": { main: 'Машина', sub: 'Бензин' },
  "teboil": { main: 'Машина', sub: 'Бензин' },
  "нефтьмагистраль": { main: 'Машина', sub: 'Бензин' },
  "shell": { main: 'Машина', sub: 'Бензин' },

  // Машина -> Парковка
  "парковка": { main: 'Машина', sub: 'Парковка' },
  "паркинг": { main: 'Машина', sub: 'Парковка' },
  "парковк": { main: 'Машина', sub: 'Парковка' },
  "стоянка": { main: 'Машина', sub: 'Парковка' },
  "московский паркинг": { main: 'Машина', sub: 'Парковка' },

  // Машина -> Кредит за авто
  "автокредит": { main: 'Машина', sub: 'Кредит за авто' },
  "кредит за авто": { main: 'Машина', sub: 'Кредит за авто' },

  // Покупки -> Дом
  "дом": { main: 'Покупки', sub: 'Дом' },
  "для дома": { main: 'Покупки', sub: 'Дом' },
  "товары для дома": { main: 'Покупки', sub: 'Дом' },
  "мелкая покупка": { main: 'Покупки', sub: 'Дом' },
  "посуда": { main: 'Покупки', sub: 'Дом' },
  "текстиль": { main: 'Покупки', sub: 'Дом' },
  "постельн": { main: 'Покупки', sub: 'Дом' },
  "хофф": { main: 'Покупки', sub: 'Дом' },
  "hoff": { main: 'Покупки', sub: 'Дом' },
  "икеа": { main: 'Покупки', sub: 'Дом' },
  "ikea": { main: 'Покупки', sub: 'Дом' },
  "леруа": { main: 'Покупки', sub: 'Дом' },
  "leroy": { main: 'Покупки', sub: 'Дом' },
  "уют": { main: 'Покупки', sub: 'Дом' },
  "мебель": { main: 'Покупки', sub: 'Дом' },
  "быт": { main: 'Покупки', sub: 'Дом' },
  "для кухни": { main: 'Покупки', sub: 'Дом' },
  "кухня": { main: 'Покупки', sub: 'Дом' },

  // Покупки -> Бытовая химия
  "бытовая химия": { main: 'Покупки', sub: 'Бытовая химия' },
  "улыбка радуги": { main: 'Покупки', sub: 'Бытовая химия' },
  "магнит косметик": { main: 'Покупки', sub: 'Бытовая химия' },
  "порошок": { main: 'Покупки', sub: 'Бытовая химия' },
  "бытовая": { main: 'Покупки', sub: 'Бытовая химия' },

  // Покупки -> Одежда
  "одежда": { main: 'Покупки', sub: 'Одежда' },
  "обувь": { main: 'Покупки', sub: 'Одежда' },
  "вайлдберриз": { main: 'Покупки', sub: 'Одежда' },
  "wildberries": { main: 'Покупки', sub: 'Одежда' },
  "wb": { main: 'Покупки', sub: 'Одежда' },
  "lamoda": { main: 'Покупки', sub: 'Одежда' },
  "ламода": { main: 'Покупки', sub: 'Одежда' },
  "zara": { main: 'Покупки', sub: 'Одежда' },
  "зара": { main: 'Покупки', sub: 'Одежда' },
  "спортмастер": { main: 'Покупки', sub: 'Одежда' },
  "кроссовки": { main: 'Покупки', sub: 'Одежда' },

  // Покупки -> Электроника
  "электроника": { main: 'Покупки', sub: 'Электроника' },
  "техника": { main: 'Покупки', sub: 'Электроника' },
  "мвидео": { main: 'Покупки', sub: 'Электроника' },
  "м.видео": { main: 'Покупки', sub: 'Электроника' },
  "эльдорадо": { main: 'Покупки', sub: 'Электроника' },
  "dns": { main: 'Покупки', sub: 'Электроника' },
  "днс": { main: 'Покупки', sub: 'Электроника' },
  "ноутбук": { main: 'Покупки', sub: 'Электроника' },
  "смартфон": { main: 'Покупки', sub: 'Электроника' },
  "наушники": { main: 'Покупки', sub: 'Электроника' },

  // Покупки -> Товары для хобби
  "хобби": { main: 'Покупки', sub: 'Товары для хобби' },
  "леонардо": { main: 'Покупки', sub: 'Товары для хобби' },
  "книги": { main: 'Покупки', sub: 'Товары для хобби' },
  "читай-город": { main: 'Покупки', sub: 'Товары для хобби' },
  "канцтовары": { main: 'Покупки', sub: 'Товары для хобби' },

  // Личное -> Внешний вид
  "маникюр": { main: 'Личное', sub: 'Внешний вид' },
  "педикюр": { main: 'Личное', sub: 'Внешний вид' },
  "стрижк": { main: 'Личное', sub: 'Внешний вид' },
  "салон": { main: 'Личное', sub: 'Внешний вид' },
  "парикмахер": { main: 'Личное', sub: 'Внешний вид' },
  "косметик": { main: 'Личное', sub: 'Внешний вид' },
  "ногти": { main: 'Личное', sub: 'Внешний вид' },
  "ресниц": { main: 'Личное', sub: 'Внешний вид' },
  "бров": { main: 'Личное', sub: 'Внешний вид' },
  "массаж": { main: 'Личное', sub: 'Внешний вид' },
  "внешний вид": { main: 'Личное', sub: 'Внешний вид' },
  "барбер": { main: 'Личное', sub: 'Внешний вид' },
  "золотое яблоко": { main: 'Личное', sub: 'Внешний вид' },

  // Личное -> Спорт
  "спорт": { main: 'Личное', sub: 'Спорт' },
  "фитнес": { main: 'Личное', sub: 'Спорт' },
  "тренировк": { main: 'Личное', sub: 'Спорт' },
  "зал": { main: 'Личное', sub: 'Спорт' },
  "бассейн": { main: 'Личное', sub: 'Спорт' },
  "йога": { main: 'Личное', sub: 'Спорт' },

  // Личное -> Привычки
  "привычк": { main: 'Личное', sub: 'Привычки' },

  // Здоровье -> Лекарства
  "аптек": { main: 'Здоровье', sub: 'Лекарства' },
  "аптека": { main: 'Здоровье', sub: 'Лекарства' },
  "лекарств": { main: 'Здоровье', sub: 'Лекарства' },
  "ригла": { main: 'Здоровье', sub: 'Лекарства' },
  "горздрав": { main: 'Здоровье', sub: 'Лекарства' },
  "еаптека": { main: 'Здоровье', sub: 'Лекарства' },

  // Здоровье -> Врачи
  "врач": { main: 'Здоровье', sub: 'Врачи' },
  "клиник": { main: 'Здоровье', sub: 'Врачи' },
  "стоматолог": { main: 'Здоровье', sub: 'Врачи' },
  "зуб": { main: 'Здоровье', sub: 'Врачи' },
  "доктор": { main: 'Здоровье', sub: 'Врачи' },
  "анализ": { main: 'Здоровье', sub: 'Врачи' },
  "инвитро": { main: 'Здоровье', sub: 'Врачи' },
  "гемотест": { main: 'Здоровье', sub: 'Врачи' },

  // Кот -> Корм для кота
  "корм": { main: 'Кот', sub: 'Корм для кота' },
  "вискас": { main: 'Кот', sub: 'Корм для кота' },
  "зоомагазин": { main: 'Кот', sub: 'Корм для кота' },
  "четыре лапы": { main: 'Кот', sub: 'Корм для кота' },

  // Кот -> Здоровье кота
  "ветклиник": { main: 'Кот', sub: 'Здоровье кота' },
  "ветеринар": { main: 'Кот', sub: 'Здоровье кота' },
};

export function resolveCategoryAndSubcategory(tx: {
  category_name?: string | null; category_icon?: string | null;
  note?: string | null; type?: string | null;
}): ResolvedCategoryInfo {
  const name = tx.type === 'transfer' ? 'Перевод' : tx.category_name?.trim() || 'Без категории';
  return { mainCategory: name, subcategory: null, displayTitle: name,
    icon: tx.category_icon || (tx.type === 'transfer' ? '🔄' : tx.type === 'income' ? '💰' : '📦') };
}

export function formatTransactionSubtitleNote(
  note?: string | null,
  resolved?: ResolvedCategoryInfo
): string {
  if (!note) return '';
  let clean = note.trim();
  if (!clean) return '';

  if (resolved?.subcategory) {
    const subLow = resolved.subcategory.toLowerCase();
    const cleanLow = clean.toLowerCase();
    if (cleanLow === subLow) {
      return '';
    }
    const prefixRegex = new RegExp(`^${resolved.subcategory}\\s*[•·:\\-]\\s*`, 'i');
    clean = clean.replace(prefixRegex, '').trim();
  }

  if (resolved?.mainCategory && clean.toLowerCase() === resolved.mainCategory.toLowerCase()) {
    return '';
  }

  return clean;
}

interface EditTransactionContentProps {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSave: (data: {
    id: string;
    amount: number;
    account_id: string;
    to_account_id?: string;
    category_id?: string;
    type: 'expense' | 'income' | 'transfer';
    note?: string | null;
    created_at?: string;
  }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onHaptic?: (type: 'light' | 'medium' | 'heavy') => void;
}


const EditTransactionModalContent: React.FC<EditTransactionContentProps> = ({
  onClose,
  transaction,
  accounts,
  categories,
  onSave,
  onDelete,
  onHaptic,
}) => {
  const resolveInitialAcc = () => transaction.account_id;
  const resolveInitialCat = () => transaction.category_id || undefined;

  const resolveInitialSubcat = () => '';

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    transaction.type || 'expense'
  );
  const [amountStr, setAmountStr] = useState<string>(transaction.amount.toString());
  const [accountId, setAccountId] = useState<string>(resolveInitialAcc());
  const [toAccountId, setToAccountId] = useState<string | null>(transaction.to_account_id || null);
  const [accPickerTarget, setAccPickerTarget] = useState<'from' | 'to'>('from');
  const [categoryId, setCategoryId] = useState<string | undefined>(resolveInitialCat());
  const [note, setNote] = useState<string>(transaction.note ?? '');
  const [selectedSubcat, setSelectedSubcat] = useState<string>(resolveInitialSubcat());
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    transaction.created_at ? new Date(transaction.created_at) : new Date()
  );

  const toInputValue = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAccPickerOpen, setIsAccPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when transaction changes
  React.useEffect(() => {
    const initialAccId = resolveInitialAcc();
    const initialCatId = resolveInitialCat();
    const initialSub = resolveInitialSubcat();

    setType(transaction.type || 'expense');
    setAmountStr(transaction.amount.toString());
    setAccountId(initialAccId);
    setToAccountId(transaction.to_account_id || null);
    setCategoryId(initialCatId);
    setNote(transaction.note ?? '');
    setSelectedSubcat(initialSub);
    setSelectedDate(transaction.created_at ? new Date(transaction.created_at) : new Date());

    setIsPickerOpen(false);
    setIsAccPickerOpen(false);
    setShowDeleteConfirm(false);
  }, [transaction]);

  const selectedAcc =
    accounts.find((a) => a.id === accountId) ||
    (transaction.account_name
      ? accounts.find((a) => {
          const tName = transaction.account_name!.toLowerCase();
          const aName = a.name.toLowerCase();
          return (
            aName === tName ||
            aName.includes(tName) ||
            tName.includes(aName) ||
            (tName.includes('едок') && aName.includes('едок')) ||
            (tName.includes('влад') && aName.includes('влад'))
          );
        })
      : null) ||
    accounts[0];
  const selectedToAcc = toAccountId
    ? accounts.find((a) => a.id === toAccountId)
    : accounts.find(a => !a.is_archived && a.id !== accountId && a.currency === selectedAcc?.currency) || null;
  const selectedCat = categories.find(c => c.id === categoryId) ||
    (categoryId && categoryId === transaction.category_id && transaction.category_name ? {
      id: categoryId, name: `${transaction.category_name} (архивная)`, icon: transaction.category_icon || '📦',
      color: '#F3F4F6', type: transaction.type === 'income' ? 'income' as const : 'expense' as const,
    } : undefined);

  const liveSum = amountStr.includes('+') ? evaluateMathSum(amountStr) : null;

  const handleAmountBlur = () => {
    if (amountStr.includes('+')) {
      const calculated = evaluateMathSum(amountStr);
      if (calculated > 0) {
        setAmountStr(calculated.toString());
      }
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAmountBlur();
    }
  };

  const handleSave = async () => {
    onHaptic?.('heavy');
    if (saving) return;
    let parsedAmount: number;
    try { parsedAmount = Number(moneyInput(amountStr)); }
    catch (cause) { setFormError((cause as Error).message); return; }
    setFormError(''); setSaving(true);
    
    let finalNote = note;
    if (selectedSubcat) {
      const cleanSub = selectedSubcat.trim();
      if (finalNote) {
        const prefixRegex = new RegExp(`^${cleanSub}\\s*[•·:\\-]\\s*`, 'i');
        if (finalNote.toLowerCase() === cleanSub.toLowerCase()) {
          finalNote = cleanSub;
        } else if (!prefixRegex.test(finalNote)) {
          finalNote = `${cleanSub} • ${finalNote}`;
        }
      } else {
        finalNote = cleanSub;
      }
    } else if (!finalNote) {
      finalNote = undefined as any;
    }

    try {
    const saved = await onSave({
      id: transaction.id,
      amount: parsedAmount,
      account_id: accountId,
      to_account_id: type === 'transfer' ? (toAccountId || selectedToAcc?.id || undefined) : undefined,
      category_id: categoryId,
      type,
      note: finalNote || null,
      created_at: selectedDate.toISOString(),
    });
    if (!saved) setFormError('Не удалось сохранить. Проверьте сообщение сервера и повторите.');
    } catch { setFormError('Не удалось сохранить. Проверьте соединение и повторите.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (saving) return;
    onHaptic?.('heavy'); setSaving(true); setFormError('');
    try {
      if (await onDelete(transaction.id)) onClose();
      else setFormError('Не удалось удалить операцию. Проверьте сообщение сервера и повторите.');
    } catch { setFormError('Не удалось удалить операцию. Проверьте соединение и повторите.'); }
    finally { setSaving(false); }
  };

  // Format date for pill: "21 сент."
  const dateLabel = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });


  const changeType = (next: 'expense' | 'income' | 'transfer') => {
    onHaptic?.('light'); setType(next);
    if (next === 'transfer') setCategoryId(undefined);
    else if (!categories.some(c => c.id === categoryId && (c.type === next || c.type === 'both'))) {
      setCategoryId(categories.find(c => c.type === next || c.type === 'both')?.id);
    }
  };
  const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const calendarLabel = selectedDate.toDateString() === today.toDateString() ? 'Сегодня' : selectedDate.toDateString() === yesterday.toDateString() ? 'Вчера' : dateLabel;
  const matchingCategories = categories.filter(c => c.type === type || c.type === 'both');
  const parentCategory = categorySelection(matchingCategories, selectedCat?.id).branch || selectedCat;
  return <TransactionEditor locked={saving} onClose={() => { if (!saving) onClose(); }} onDelete={() => setShowDeleteConfirm(true)} type={type} onType={changeType}
    dateValue={toInputValue(selectedDate)} dateLabel={calendarLabel} onDate={value => {
      const [y,m,d] = value.split('-').map(Number); const next = new Date(selectedDate); next.setFullYear(y,m-1,d); setSelectedDate(next);
    }} source={selectedAcc} destination={selectedToAcc}
    onSource={() => { setAccPickerTarget('from'); setIsAccPickerOpen(true); }} onDestination={() => { setAccPickerTarget('to'); setIsAccPickerOpen(true); }}
    onSwap={() => { if(selectedToAcc) { setAccountId(selectedToAcc.id); setToAccountId(accountId); } }}
    amount={amountStr} onAmount={setAmountStr} onAmountBlur={handleAmountBlur} onAmountKeyDown={handleAmountKeyDown}
    amountHint={liveSum !== null && liveSum > 0 ? <button onClick={() => setAmountStr(liveSum.toString())}>= {liveSum} {currencyLabel(selectedAcc?.currency || 'RUB')}</button> : null}
    category={parentCategory} onCategory={() => setIsPickerOpen(open => !open)}
    choices={<CategorySelection categories={matchingCategories} selected={categoryId} expanded={isPickerOpen}
      onSelect={cat => { setCategoryId(cat.id); setSelectedSubcat(''); }} onCollapse={() => setIsPickerOpen(false)} />}
    note={note} onNote={setNote} onSave={() => void handleSave()} saving={saving} error={formError}>
    <AccountSelectSheet isOpen={isAccPickerOpen} onClose={() => setIsAccPickerOpen(false)}
      accounts={accounts.filter(a => !a.is_archived && (accPickerTarget === 'to' ? a.id !== accountId && a.currency === selectedAcc?.currency : true))}
      selectedAccountId={accPickerTarget === 'to' ? toAccountId || '' : accountId}
      onSelectAccount={a => { if(accPickerTarget === 'to') setToAccountId(a.id); else { setAccountId(a.id); if (selectedToAcc?.id === a.id || selectedToAcc?.currency !== a.currency) setToAccountId(null); } setIsAccPickerOpen(false); }} />
    {showDeleteConfirm && <ConfirmPanel title="Удалить операцию?" description="Баланс счёта будет автоматически восстановлен."
      action="Удалить" busy={saving} error={formError} onCancel={() => { if (!saving) setShowDeleteConfirm(false); }} onConfirm={() => void handleDelete()} />}
  </TransactionEditor>;
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = (props) => {
  if (!props.isOpen || !props.transaction) return null;
  return (
    <EditTransactionModalContent
      {...props}
      transaction={props.transaction}
    />
  );
};
