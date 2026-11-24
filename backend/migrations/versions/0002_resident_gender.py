"""Add a gender choice for the monitored resident."""
from alembic import op
import sqlalchemy as sa

revision = "0002_resident_gender"
down_revision = "0001_senso_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("residences")}
    if "resident_gender" not in columns:
        op.add_column(
            "residences",
            sa.Column("resident_gender", sa.String(16), server_default="nao_informado", nullable=False),
        )
    op.execute(
        sa.text(
            "UPDATE residences SET resident_gender = 'feminino' "
            "WHERE resident_name = 'Helena Duarte' AND resident_gender = 'nao_informado'"
        )
    )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("residences")}
    if "resident_gender" in columns:
        op.drop_column("residences", "resident_gender")
