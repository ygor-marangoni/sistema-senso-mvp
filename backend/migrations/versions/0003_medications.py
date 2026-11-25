"""Add medication schedules and confirmations."""
from alembic import op
import sqlalchemy as sa

revision = "0003_medications"
down_revision = "0002_resident_gender"
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "medications" not in tables:
        op.create_table(
            "medications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("residence_id", sa.Integer(), sa.ForeignKey("residences.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("dosage", sa.String(120), nullable=False),
            sa.Column("instructions", sa.String(300), nullable=False),
            sa.Column("time_of_day", sa.String(5), nullable=False),
            sa.Column("weekdays", sa.JSON(), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "ix_medications_residence_id" not in {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes("medications")}:
        op.create_index("ix_medications_residence_id", "medications", ["residence_id"])
    if "medication_confirmations" not in tables:
        op.create_table(
            "medication_confirmations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("medication_id", sa.Integer(), sa.ForeignKey("medications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("scheduled_date", sa.Date(), nullable=False),
            sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("confirmed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.UniqueConstraint("medication_id", "scheduled_date", name="uq_medication_date"),
        )
    if "ix_medication_confirmations_medication_id" not in {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes("medication_confirmations")}:
        op.create_index("ix_medication_confirmations_medication_id", "medication_confirmations", ["medication_id"])


def downgrade():
    op.drop_table("medication_confirmations")
    op.drop_table("medications")
