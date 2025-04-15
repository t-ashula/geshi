import os
import shutil
import sys
from pathlib import Path
from unittest import mock

import pytest

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.scheduler import cleanup_uploads


@pytest.fixture
def mock_redis(monkeypatch):
    """Mock for Redis"""
    mock_redis_conn = mock.MagicMock()
    monkeypatch.setattr("src.scheduler.conn", mock_redis_conn)
    return mock_redis_conn


@pytest.fixture
def mock_upload_dir(monkeypatch, tmp_path):
    """Mock for upload directory"""
    # Create temporary directory for testing
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()

    # Create test request directories
    (upload_dir / "valid-id").mkdir()
    (upload_dir / "expired-id").mkdir()

    # Mock the UPLOAD_DIR path
    monkeypatch.setattr("src.scheduler.UPLOAD_DIR", upload_dir)

    return upload_dir


def test_cleanup_uploads(mock_redis, mock_upload_dir):
    """Test for cleanup job"""

    # Set up mock
    def exists_side_effect(key):
        # valid-id exists, expired-id does not
        return key == "transcription:valid-id"

    mock_redis.exists.side_effect = exists_side_effect

    # Execute function
    cleanup_uploads()

    # Verify directories
    assert (mock_upload_dir / "valid-id").exists()  # Directory with valid ID remains
    assert not (
        mock_upload_dir / "expired-id"
    ).exists()  # Directory with expired ID is deleted

    # Verify mock calls
    assert mock_redis.exists.call_count == 2
    mock_redis.exists.assert_any_call("transcription:valid-id")
    mock_redis.exists.assert_any_call("transcription:expired-id")


def test_cleanup_uploads_no_directory(mock_redis, monkeypatch):
    """Test for when upload directory does not exist"""
    # Mock a non-existent directory
    nonexistent_dir = Path("/nonexistent/dir")
    monkeypatch.setattr("src.scheduler.UPLOAD_DIR", nonexistent_dir)

    # Execute function (verify no exception is raised)
    cleanup_uploads()

    # Verify mock calls
    mock_redis.exists.assert_not_called()


def test_cleanup_uploads_exception_handling(mock_redis, mock_upload_dir, monkeypatch):
    """Test for exception handling"""
    # Set up mock
    mock_redis.exists.return_value = False  # All keys do not exist

    # Mock rmtree to raise an exception
    def mock_rmtree(*args, **kwargs):
        raise PermissionError("Test permission error")

    monkeypatch.setattr("shutil.rmtree", mock_rmtree)

    # Execute function (verify no exception is raised)
    cleanup_uploads()

    # Verify mock calls
    assert mock_redis.exists.call_count == 2
