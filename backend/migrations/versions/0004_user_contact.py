"""Add optional contact details to responsible user profiles."""
from alembic import op
import sqlalchemy as sa

revision = "0004_user_contact"
down_revision = "0003_medications"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("phone", sa.String(40), server_default="", nullable=False))
    op.add_column("users", sa.Column("cpf", sa.String(11), server_default="", nullable=False))


def downgrade():
    op.drop_column("users", "cpf")
    op.drop_column("users", "phone")
