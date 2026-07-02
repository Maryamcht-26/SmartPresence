import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import engine
from app.db.base import Base
from app.models import FaceEnrollment

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Done!")
