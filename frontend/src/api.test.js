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

  it('asks for one question\'s answer with a plain GET', async () => {
    const fetch = mockFetch({ body: { question_id: 'q 2', answer_index: 1, explanation: 'Because.' } });

    const revealed = await api.quizzes.answer('quiz1', 'q 2');

    expect(called(fetch)).toMatchObject({ url: 'http://localhost:8000/api/quizzes/quiz1/questions/q%202/answer', method: 'GET' });
    expect(revealed.answer_index).toBe(1);
  });

  it('leaves out history filters that are not set', async () => {
    const fetch = mockFetch({ body: {} });
    await api.history.list({ courseId: 'c1', limit: 5 });
    expect(called(fetch).url).toBe('http://localhost:8000/api/history?course_id=c1&limit=5');
  });
});

describe('materials (a section\'s PDF)', () => {
  const file = new File(['%PDF-'], 'slides.pdf', { type: 'application/pdf' });

  it('uploads the PDF to the section as multipart form data', async () => {
    const fetch = mockFetch({ status: 201, body: { id: 'm1' } });

    const material = await api.materials.upload('s1', file);

    expect(material.id).toBe('m1');
    const call = called(fetch);
    expect(call).toMatchObject({ url: 'http://localhost:8000/api/sections/s1/materials', method: 'POST' });
    expect(call.body.get('file')).toBe(file);
  });

  it('lists a section\'s PDFs and removes one', async () => {
    const fetch = mockFetch({ body: [] }, { status: 204 });

    await api.materials.list('s1');
    await api.materials.remove('m1');

    expect(called(fetch, 0).url).toBe('http://localhost:8000/api/sections/s1/materials');
    expect(called(fetch, 1)).toMatchObject({ url: 'http://localhost:8000/api/materials/m1', method: 'DELETE' });
  });
});
