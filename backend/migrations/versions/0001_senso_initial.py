"""Initial schema for the independent Sistema Senso database.

Revision ID: 0001_senso_initial
Revises:
"""
from alembic import op

from app.db.base import Base
import app.models  # register only Senso tables in this metadata

revision = "0001_senso_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The app rejects every non-Senso PostgreSQL database before Alembic connects.
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
