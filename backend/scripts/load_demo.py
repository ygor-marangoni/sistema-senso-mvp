"""Create the fictional Senso demo account and a reproducible 30-day history."""
import argparse
import secrets

from pwdlib import PasswordHash
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Event, Residence, User
from app.services.demo import ensure_demo_appointments, ensure_demo_medications, populate_demo_history
from app.services.residence import create_residence

DEMO_EMAIL = "demo@senso.local"
password_hash = PasswordHash.recommended()


def load_demo(reset: bool = False) -> None:
    if not get_settings().demo_login_enabled:
        raise RuntimeError("A conta demonstrativa compartilhada está desativada neste ambiente.")
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if reset and user:
            db.delete(user)
            db.commit()
            user = None
        if not user:
            # The local demo button authenticates via /auth/demo. Assign an
            # unshared random password to satisfy the normal account model.
            user = User(name="Mariana Duarte", email=DEMO_EMAIL, password_hash=password_hash.hash(secrets.token_urlsafe(32)))
            db.add(user)
            db.flush()
        residence = db.scalar(select(Residence).where(Residence.owner_id == user.id).order_by(Residence.id).limit(1))
        if not residence:
            residence = create_residence(db, user, demo=True)
            db.flush()
        ensure_demo_medications(db, residence)
        ensure_demo_appointments(db, residence)
        event_count = db.scalar(select(func.count(Event.id)).where(Event.residence_id == residence.id)) or 0
        if not event_count:
            populate_demo_history(db, residence, days=31)
            db.commit()
            print("Dados demonstrativos prontos. Use o botão de demonstração no ambiente local.")
        else:
            db.commit()
            print(f"Conta demonstrativa já configurada ({event_count} eventos existentes).")
        print("O script usa somente o banco senso configurado em DATABASE_URL.")
        print("Use --reset-demo para recriar somente esta conta fictícia e seus dados.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset-demo", action="store_true", help="Apaga e recria apenas a conta demo@senso.local")
    load_demo(parser.parse_args().reset_demo)
