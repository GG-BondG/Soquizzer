import { ApiError, api, formatDetail, friendlyError, subjectLabel } from './api.js';

// A fake fetch that answers with the given responses in order. `body` is JSON-encoded unless it is a string.
function mockFetch(...responses) {
  const queue = [...responses];
  const fetch = vi.fn(async () => {
    const { status = 200, body } = queue.shift();
    const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, statusText: `status ${status}`, text: async () => text };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const called = (fetch, n = 0) => {
  const [url, init] = fetch.mock.calls[n];
  return { url: String(url), method: init.method, body: init.body };
};

afterEach(() => vi.unstubAllGlobals());

describe('formatDetail', () => {
  it('passes a string through', () => {
    expect(formatDetail('Course not found')).toBe('Course not found');
  });

  it('turns validation errors into readable text', () => {
    const detail = [
      { loc: ['body', 'name'], msg: 'String should have at least 1 character' },
      { loc: ['query', 'limit'], msg: 'Input should be greater than 0' },
      { msg: 'Something else' },
    ];
    expect(formatDetail(detail)).toBe(
      'Name: String should have at least 1 character; Limit: Input should be greater than 0; Something else'
    );
  });

  it('has no text for anything else', () => {
    expect(formatDetail(null)).toBeNull();
    expect(formatDetail({})).toBeNull();
  });
});

describe('friendlyError', () => {
  it('prefers the message for that status, then the error text, then a default', () => {
    const err = new ApiError('Server said no', { status: 415 });
    expect(friendlyError(err, { 415: 'Only PDFs.' })).toBe('Only PDFs.');
    expect(friendlyError(err, { 500: 'x' })).toBe('Server said no');
    expect(friendlyError(new Error(''))).toBe('Something went wrong.');
  });
});

describe('subjectLabel', () => {
  it('names a subject and falls back to the raw value', () => {
    expect(subjectLabel('COMPUTER_SCIENCE')).toBe('Computer science');
    expect(subjectLabel('ART')).toBe('ART');
  });
});

describe('requests', () => {
  it('sends JSON and returns the parsed body', async () => {
    const fetch = mockFetch({ status: 201, body: { id: 'c1', name: 'Bio' } });

    const course = await api.courses.create({ name: 'Bio', subject: 'BIOLOGY' });

    expect(course).toEqual({ id: 'c1', name: 'Bio' });
    const request = called(fetch);
    expect(request.url).toBe('http://localhost:8000/api/courses');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toEqual({ name: 'Bio', subject: 'BIOLOGY' });
  });

  it('resolves to null for an empty 204', async () => {
    mockFetch({ status: 204 });
    expect(await api.courses.remove('c1')).toBeNull();
  });

  it('encodes ids in the path', async () => {
    const fetch = mockFetch({ body: {} });
    await api.courses.get('a/b c');
    expect(called(fetch).url).toBe('http://localhost:8000/api/courses/a%2Fb%20c');
  });

  it('rejects with the server message, status and detail', async () => {
    mockFetch({ status: 404, body: { detail: 'Course c1 not found' } });

    const error = await api.courses.get('c1').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Course c1 not found', status: 404, detail: 'Course c1 not found' });
  });

  it('formats a 422 validation error', async () => {
    mockFetch({ status: 422, body: { detail: [{ loc: ['body', 'name'], msg: 'Field required' }] } });
    await expect(api.courses.create({ name: '', subject: 'MATH' })).rejects.toThrow('Name: Field required');
  });

  it('falls back to the status line when the error has no JSON body', async () => {
    mockFetch({ status: 502, body: 'Bad gateway' });
    await expect(api.courses.list()).rejects.toThrow('Request failed (502 status 502).');
  });

  it('says the backend is unreachable when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await api.courses.list().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Can't reach the server/);
  });

  it('maps the quiz submission fields to the backend names', async () => {
    const fetch = mockFetch({ status: 201, body: { score: 1 } });

    await api.quizzes.submit('q1', { answers: [{ question_id: 'a', selected_index: 1 }], timeSpentSeconds: 42 });

    expect(JSON.parse(called(fetch).body)).toEqual({
      answers: [{ question_id: 'a', selected_index: 1 }],
      time_spent_seconds: 42,
    });
  });

  it('leaves out history filters that are not set', async () => {
    const fetch = mockFetch({ body: {} });
    await api.history.list({ courseId: 'c1', limit: 5 });
    expect(called(fetch).url).toBe('http://localhost:8000/api/history?course_id=c1&limit=5');
  });
});

describe('textbooks.upload', () => {
  const file = new File(['text'], 'bio.txt', { type: 'text/plain' });

  it('uploads the file, then attaches it to the course', async () => {
    const fetch = mockFetch({ status: 202, body: { id: 't1', status: 'PROCESSING' } }, { status: 204 });

    const textbook = await api.textbooks.upload('c1', file);

    expect(textbook.id).toBe('t1');
    expect(called(fetch, 0)).toMatchObject({ url: 'http://localhost:8000/api/textbooks', method: 'POST' });
    expect(called(fetch, 0).body).toBeInstanceOf(FormData);
    expect(called(fetch, 1)).toMatchObject({ url: 'http://localhost:8000/api/courses/c1/textbooks/t1', method: 'PUT' });
  });

  it('attaches a file that was uploaded before instead of failing', async () => {
    const id = '4f3a6c1e-9b2f-4c1d-8e7a-123456789abc';
    const fetch = mockFetch(
      { status: 409, body: { detail: `This file was already uploaded as textbook ${id}` } },
      { status: 204 }
    );

    const textbook = await api.textbooks.upload('c1', file);

    expect(textbook.id).toBe(id);
    expect(called(fetch, 1).url).toBe(`http://localhost:8000/api/courses/c1/textbooks/${id}`);
  });

  it('gives up without attaching when the upload fails for another reason', async () => {
    const fetch = mockFetch({ status: 415, body: { detail: "Unsupported file type '.exe'" } });

    await expect(api.textbooks.upload('c1', file)).rejects.toMatchObject({ status: 415 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up on a duplicate error that names no textbook', async () => {
    const fetch = mockFetch({ status: 409, body: { detail: 'This file was already uploaded' } });

    await expect(api.textbooks.upload('c1', file)).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('detaches a textbook from a course', async () => {
    const fetch = mockFetch({ status: 204 });
    await api.textbooks.detach('c1', 't1');
    expect(called(fetch)).toMatchObject({ url: 'http://localhost:8000/api/courses/c1/textbooks/t1', method: 'DELETE' });
  });
});
