"""Durable owner-scoped identities for account/category creation commands."""
from sqlalchemy import BigInteger, Column, String
from app.core.database import Base


class EntityCreation(Base):
    __tablename__ = "entity_creations"
    user_id = Column(BigInteger, primary_key=True)
    kind = Column(String(32), primary_key=True)
    client_id = Column(String(64), primary_key=True)
    fingerprint = Column(String(64), nullable=False)
    object_id = Column(String(36), nullable=False)
