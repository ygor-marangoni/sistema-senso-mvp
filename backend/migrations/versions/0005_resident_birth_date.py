"""Store an optional birth date without guessing from the recorded age."""
from alembic import op
import sqlalchemy as sa

revision = "0005_resident_birth_date"
down_revision = "0004_user_contact"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("residences", sa.Column("resident_birth_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("residences", "resident_birth_date")
