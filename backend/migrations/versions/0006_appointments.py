"""Add scheduled medical appointments to the residence agenda."""
from alembic import op
import sqlalchemy as sa


revision = "0006_appointments"
down_revision = "0005_resident_birth_date"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("residence_id", sa.Integer(), sa.ForeignKey("residences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("appointment_type", sa.String(20), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("time_of_day", sa.String(5), nullable=False),
        sa.Column("professional", sa.String(120), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("notes", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_appointments_residence_id", "appointments", ["residence_id"])
    op.create_index("ix_appointments_scheduled_date", "appointments", ["scheduled_date"])


def downgrade():
    op.drop_table("appointments")
