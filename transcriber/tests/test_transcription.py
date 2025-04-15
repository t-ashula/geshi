import json
import os
import sys
from datetime import datetime, timedelta
from unittest import mock

import pytest
import redis
from src.transcriber import transcribe_with_model

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.transcription import process_transcription, update_status


@pytest.fixture
def mock_redis(monkeypatch):
    """Mock for Redis"""
    mock_redis_conn = mock.MagicMock()

    # Patch the setex method to handle json.dumps
    def mock_setex(key, ttl, value):
        # Just return True, we don't need to actually store the value
        return True

    mock_redis_conn.setex.side_effect = mock_setex

    monkeypatch.setattr("src.transcription.redis_conn", mock_redis_conn)
    return mock_redis_conn


@pytest.fixture
def mock_file_path(tmp_path):
    """Temporary file path for testing"""
    test_file = tmp_path / "test.wav"
    test_file.write_bytes(b"dummy wav content")
    return str(test_file)


@pytest.fixture
def mock_transcribe_with_model(monkeypatch):
    """Mock for transcribe_with_model"""
    mock_func = mock.MagicMock()
    mock_func.return_value = {
        "text": "これはテストの文字起こしです。",
        "lang": "ja",
        "segments": [
            {"start": 0.0, "end": 2.0, "text": "これはテスト"},
            {"start": 2.0, "end": 4.0, "text": "の文字起こしです。"},
        ],
        "stats": {"process_time": 1.5},
    }
    monkeypatch.setattr("src.transcription.transcribe_with_model", mock_func)
    return mock_func


def test_process_transcription_success(
    mock_redis, mock_file_path, mock_transcribe_with_model
):
    """Test for successful transcription processing"""
    # Set up mock
    mock_redis.setex.return_value = True

    # Execute function
    result = process_transcription("test-id", mock_file_path, "ja", "base")

    # Verify result
    assert result["status"] == "done"
    assert "error" not in result

    # Verify mock call
    # TODO: check call arguments
    assert mock_redis.setex.call_count == 2


def test_process_transcription_file_not_found(mock_redis, mock_transcribe_with_model):
    """Test for non-existent file"""
    # Execute function
    result = process_transcription("test-id", "/nonexistent/path.wav", "ja", "base")

    # Verify result
    assert result["status"] == "error"
    assert "error" in result
    assert result["error"] == "FileNotFoundError"

    # Verify mock call
    # TODO: check call arguments
    assert mock_redis.setex.call_count == 2


def test_process_transcription_exception(
    mock_redis, mock_file_path, mock_transcribe_with_model, monkeypatch
):
    """Test for exception handling"""

    # Set up mock
    class RuntimeCustomException(Exception):
        pass

    # Mock transcribe_with_model to raise an exception
    mock_transcribe_with_model.side_effect = RuntimeCustomException("Test exception")
    mock_redis.setex.return_value = True

    # Execute function
    result = process_transcription("test-id", mock_file_path, "ja", "base")

    # Verify result
    assert result["status"] == "error"
    assert "error" in result
    assert result["error"] == "RuntimeCustomException"


def test_update_status_new_key(mock_redis):
    """Test for updating status with a new key"""
    # Set up mock
    mock_redis.get.return_value = None
    mock_redis.setex.return_value = True

    # Execute function
    update_status("test-id", "working")

    # Verify mock calls
    mock_redis.get.assert_called_once_with("transcription:test-id")
    mock_redis.setex.assert_called_once()

    # Verify setex arguments
    args = mock_redis.setex.call_args[0]
    kwargs = mock_redis.setex.call_args[1]
    assert "transcription:test-id" in args
    assert json.loads(args[2])["status"] == "working"


def test_update_status_existing_key(mock_redis):
    """Test for updating status with an existing key"""
    # Set up mock
    existing_data = {"status": "pending", "extra": "data"}
    mock_redis.get.return_value = json.dumps(existing_data).encode()
    mock_redis.setex.return_value = True

    # Execute function
    update_status("test-id", "working")

    # Verify mock calls
    mock_redis.get.assert_called_once_with("transcription:test-id")
    mock_redis.setex.assert_called_once()

    # Verify setex arguments
    args = mock_redis.setex.call_args[0]
    kwargs = mock_redis.setex.call_args[1]
    updated_data = json.loads(args[2])
    assert updated_data["status"] == "working"
    assert updated_data["extra"] == "data"  # Other data is preserved


def test_update_status_json_error(mock_redis):
    """Test for updating status with non-JSON data"""
    # Set up mock
    mock_redis.get.return_value = b"invalid json"
    mock_redis.setex.return_value = True

    # Execute function
    update_status("test-id", "working")

    # Verify mock calls
    mock_redis.get.assert_called_once_with("transcription:test-id")
    mock_redis.setex.assert_called_once()

    # Verify setex arguments
    args = mock_redis.setex.call_args[0]
    kwargs = mock_redis.setex.call_args[1]
    assert json.loads(args[2])["status"] == "working"
