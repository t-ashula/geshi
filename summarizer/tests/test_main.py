import json
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from src.main import app, queue, redis_conn

client = TestClient(app)


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Summarizer API"}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.fixture
def mock_redis():
    with mock.patch("src.main.redis_conn") as mock_redis:
        yield mock_redis


@pytest.fixture
def mock_queue():
    with mock.patch("src.main.queue") as mock_queue:
        yield mock_queue


def test_summarize_text(mock_redis, mock_queue):
    # Test request data
    request_data = {
        "text": "This is a test text for summarization.",
        "strength": 3,
    }

    # Mock Redis setex method
    mock_redis.setex.return_value = True

    # Mock queue enqueue method
    mock_queue.enqueue.return_value = None

    # Call API endpoint
    response = client.post("/summarize", json=request_data)

    # Verify response
    assert response.status_code == 202
    assert "request_id" in response.json()

    # Verify data was saved to Redis
    mock_redis.setex.assert_called_once()

    # Verify job was added to queue
    mock_queue.enqueue.assert_called_once()


def test_summarize_text_invalid_input(mock_redis, mock_queue):
    # Request with empty text
    request_data = {"text": "", "strength": 3}

    # Call API endpoint
    response = client.post("/summarize", json=request_data)

    # Verify response
    assert response.status_code == 400
    assert "error" in response.json()["detail"]

    # Verify no data was saved to Redis
    mock_redis.setex.assert_not_called()

    # Verify no job was added to queue
    mock_queue.enqueue.assert_not_called()


def test_get_summarization_success(mock_redis):
    # Test request ID
    request_id = "test_request_id"

    # Test summary result
    result_data = {
        "status": "done",
        "summary": "This is a test summary.",
        "expires_at": "2025-04-17T00:00:00Z",
    }

    # Mock Redis get method
    mock_redis.get.return_value = json.dumps(result_data)

    # Call API endpoint
    response = client.get(f"/summarize/{request_id}")

    # Verify response
    assert response.status_code == 200
    assert response.json()["status"] == "done"
    assert response.json()["summary"] == "This is a test summary."
    assert response.json()["expires_at"] == "2025-04-17T00:00:00Z"

    # Verify data was retrieved from Redis
    mock_redis.get.assert_called_once_with(f"summarize:{request_id}")


def test_get_summarization_not_found(mock_redis):
    # Test request ID for non-existent request
    request_id = "nonexistent_request_id"

    # Mock Redis get method (non-existent key)
    mock_redis.get.return_value = None

    # Call API endpoint
    response = client.get(f"/summarize/{request_id}")

    # Verify response
    assert response.status_code == 404
    assert "error" in response.json()["detail"]

    # Verify data retrieval attempt from Redis
    mock_redis.get.assert_called_once_with(f"summarize:{request_id}")


def test_get_summarization_pending(mock_redis):
    # Test request ID for pending request
    request_id = "pending_request_id"

    # Test pending status
    result_data = {"status": "pending"}

    # Mock Redis get method
    mock_redis.get.return_value = json.dumps(result_data)

    # Call API endpoint
    response = client.get(f"/summarize/{request_id}")

    # Verify response
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert "summary" not in response.json()

    # Verify data was retrieved from Redis
    mock_redis.get.assert_called_once_with(f"summarize:{request_id}")


def test_get_summarization_error(mock_redis):
    # Test request ID for error case
    request_id = "error_request_id"

    # Test error status
    result_data = {"status": "error", "error": "SomeError"}

    # Mock Redis get method
    mock_redis.get.return_value = json.dumps(result_data)

    # Call API endpoint
    response = client.get(f"/summarize/{request_id}")

    # Verify response
    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert response.json()["error"] == "SomeError"

    # Verify data was retrieved from Redis
    mock_redis.get.assert_called_once_with(f"summarize:{request_id}")
