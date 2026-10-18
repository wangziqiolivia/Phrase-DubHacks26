"""CRUD only; no provisioning, indexes, migrations, or startup writes."""
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument

load_dotenv(Path(__file__).with_name(".env"))


@lru_cache(maxsize=1)
def get_client():
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not configured")
    return MongoClient(uri, connect=False, serverSelectionTimeoutMS=5000, tz_aware=True)


def collection():
    name = os.getenv("MONGODB_DATABASE")
    if not name:
        raise RuntimeError("MONGODB_DATABASE is not configured")
    return get_client()[name]["records"]


def serialize(document):
    if document is None:
        return None
    document["id"] = str(document.pop("_id"))
    return document


def create_record(data):
    document = {"data": data, "created_at": datetime.now(timezone.utc)}
    result = collection().insert_one(document)
    document["_id"] = result.inserted_id
    return serialize(document)


def get_record(record_id):
    return serialize(collection().find_one({"_id": ObjectId(record_id)}))


def replace_record(record_id, data):
    return serialize(collection().find_one_and_update(
        {"_id": ObjectId(record_id)},
        {"$set": {"data": data}},
        return_document=ReturnDocument.AFTER,
    ))


def delete_record(record_id):
    return collection().delete_one({"_id": ObjectId(record_id)}).deleted_count == 1


def ping():
    get_client().admin.command("ping")


def close_client():
    if get_client.cache_info().currsize:
        get_client().close()
        get_client.cache_clear()
