from bson import ObjectId
from fastapi import APIRouter, HTTPException, Response

from . import database
from .models import Health, Record, RecordData

router = APIRouter()


def validate_id(record_id: str):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(400, "Invalid record ID")


def require_record(record):
    if record is None:
        raise HTTPException(404, "Record not found")
    return record


@router.post("/api/records", response_model=Record, status_code=201)
def create_record(body: RecordData):
    return database.create_record(body.root)


@router.get("/api/records/{record_id}", response_model=Record)
def get_record(record_id: str):
    validate_id(record_id)
    return require_record(database.get_record(record_id))


@router.put("/api/records/{record_id}", response_model=Record)
def replace_record(record_id: str, body: RecordData):
    """Replace all data while preserving ID and creation time."""
    validate_id(record_id)
    return require_record(database.replace_record(record_id, body.root))


@router.delete("/api/records/{record_id}", status_code=204)
def delete_record(record_id: str):
    validate_id(record_id)
    if not database.delete_record(record_id):
        raise HTTPException(404, "Record not found")
    return Response(status_code=204)


@router.get("/health", response_model=Health)
def health(check_database: bool = False):
    if check_database:
        database.ping()
    return {"status": "ok", "database": "ok" if check_database else "not_checked"}
