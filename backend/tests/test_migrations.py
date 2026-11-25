"""Exercise the Alembic revisions against a fresh, isolated database."""
from importlib import import_module

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect


def test_all_revisions_run_on_empty_database_without_duplicate_schema():
    engine = create_engine('sqlite://')
    revisions = [
        '0001_senso_initial', '0002_resident_gender', '0003_medications',
        '0004_user_contact', '0005_resident_birth_date', '0006_appointments',
        '0007_simulation_clock',
    ]
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            for revision in revisions:
                import_module(f'migrations.versions.{revision}').upgrade()
        inspector = inspect(connection)
        assert {'users', 'residences', 'medications', 'medication_confirmations', 'appointments', 'simulation_runs'} <= set(inspector.get_table_names())
        assert {'phone', 'cpf'} <= {column['name'] for column in inspector.get_columns('users')}
        assert {'elapsed_base', 'speed', 'run_token'} <= {column['name'] for column in inspector.get_columns('simulation_runs')}
        assert 'ix_appointments_residence_id' in {index['name'] for index in inspector.get_indexes('appointments')}
    engine.dispose()
