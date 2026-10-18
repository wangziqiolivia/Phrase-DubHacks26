"""Accept JSON objects without application-specific fields."""
from datetime import datetime
from typing import Literal

from bson import BSON
from bson.errors import InvalidDocument
from pydantic import BaseModel, JsonValue, RootModel, model_validator


class RecordData(RootModel[dict[str, JsonValue]]):
    @model_validator(mode="after")
    def check_storage_limits(self):
        try:
            encoded = BSON.encode({"data": self.root})
        except (InvalidDocument, OverflowError, RecursionError, UnicodeError) as exc:
            raise ValueError("JSON cannot be stored; check keys, nesting, and integer range") from exc
        # Leave room for metadata below MongoDB's 16 MiB document limit.
        if len(encoded) > 15 * 1024 * 1024:
            raise ValueError("Record must be at most 15 MiB when BSON encoded")
        return self


class Record(BaseModel):
    id: str
    created_at: datetime
    data: dict[str, JsonValue]


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    database: Literal["not_checked", "ok"] = "not_checked"
