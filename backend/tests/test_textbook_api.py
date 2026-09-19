from tests.conftest import make_blank_pdf, make_pdf

TEXT = ("Mitochondria are the powerhouse of the cell. They produce ATP through respiration. " * 12).encode()


def upload(client, name="bio.txt", content=TEXT):
    return client.post("/api/textbooks", files={"file": (name, content)})


def test_upload_text_is_ingested_into_chroma(client, chunks):
    response = upload(client)

    assert response.status_code == 202
    assert response.json()["status"] == "PROCESSING"

    textbook = client.get(f"/api/textbooks/{response.json()['id']}").json()
    assert textbook["status"] == "READY"
    assert textbook["chunk_count"] > 1

    hits = chunks.search("mitochondria", k=3, textbook_id=textbook["id"])
    assert len(hits) == 3
    assert all(h.metadata["textbook_id"] == textbook["id"] for h in hits)


def test_upload_pdf_keeps_page_numbers(client, chunks):
    pdf = make_pdf(["Page one is about cells and their organelles.", "Page two covers photosynthesis in plants."])
    textbook_id = upload(client, "bio.pdf", pdf).json()["id"]

    assert client.get(f"/api/textbooks/{textbook_id}").json()["status"] == "READY"
    pages = {h.metadata["page"] for h in chunks.search("photosynthesis", k=5, textbook_id=textbook_id)}
    assert pages == {1, 2}


def test_pdf_without_text_is_marked_failed(client, chunks):
    textbook_id = upload(client, "scan.pdf", make_blank_pdf()).json()["id"]

    textbook = client.get(f"/api/textbooks/{textbook_id}").json()
    assert textbook["status"] == "FAILED"
    assert "No extractable text" in textbook["error"]


def test_duplicate_upload_is_rejected(client):
    first = upload(client).json()
    second = upload(client, name="renamed.txt")

    assert second.status_code == 409
    assert first["id"] in second.json()["detail"]
    assert len(client.get("/api/textbooks").json()) == 1


def test_unsupported_type_is_rejected(client):
    assert upload(client, "notes.exe", b"x").status_code == 415


def test_oversized_upload_is_rejected_and_not_kept(client, settings):
    response = upload(client, content=b"a" * (settings.max_upload_bytes + 1))

    assert response.status_code == 413
    assert list(settings.upload_dir.iterdir()) == []


def test_delete_removes_record_file_and_chunks(client, chunks, settings):
    textbook_id = upload(client).json()["id"]

    assert client.delete(f"/api/textbooks/{textbook_id}").status_code == 204
    assert client.get(f"/api/textbooks/{textbook_id}").status_code == 404
    assert chunks.search("mitochondria", textbook_id=textbook_id) == []
    assert list(settings.upload_dir.iterdir()) == []


def test_unknown_textbook_returns_404(client):
    assert client.get("/api/textbooks/nope").status_code == 404
    assert client.delete("/api/textbooks/nope").status_code == 404
