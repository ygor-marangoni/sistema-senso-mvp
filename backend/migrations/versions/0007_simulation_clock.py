"""Persist the logical simulation clock and execution identifier."""
from alembic import op
import sqlalchemy as sa

revision = "0007_simulation_clock"
down_revision = "0006_appointments"
branch_labels = None
depends_on = None

def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("simulation_runs")}
    if "elapsed_base" not in columns:
        op.add_column("simulation_runs", sa.Column("elapsed_base", sa.Float(), nullable=False, server_default="0"))
    if "speed" not in columns:
        op.add_column("simulation_runs", sa.Column("speed", sa.Float(), nullable=False, server_default="1"))
    if "run_token" not in columns:
        op.add_column("simulation_runs", sa.Column("run_token", sa.String(36), nullable=True))

def downgrade():
    op.drop_column("simulation_runs", "run_token")
    op.drop_column("simulation_runs", "speed")
    op.drop_column("simulation_runs", "elapsed_base")
