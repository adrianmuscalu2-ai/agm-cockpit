import {
  executeControlledVisionTransfer,
  VisionTransferError,
} from '../src/common/image-security/controlled-vision-transfer';

describe('controlled Vision transfer lifecycle', () => {
  it('uses only the allowlisted HTTPS endpoint, rejects redirects, and clears the owned buffer', async () => {
    const image = Buffer.from('private-image-bytes');
    const fetchMock = jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse({ ok: true }));

    const result = await executeControlledVisionTransfer(validInput(image), fetchMock);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init?.redirect).toBe('error');
    expect(init?.method).toBe('POST');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(image.every((byte) => byte === 0)).toBe(true);
  });

  it('returns only a controlled error without response payload or secret', async () => {
    const secret = 'secret-sentinel';
    const providerPayload = 'provider-private-payload';
    const fetchMock = jest.fn(async () => new Response(providerPayload, { status: 429 }));

    try {
      await executeControlledVisionTransfer({ ...validInput(Buffer.from('image')), apiKey: secret }, fetchMock);
      throw new Error('Expected provider failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(VisionTransferError);
      expect((error as VisionTransferError).code).toBe('VISION_PROVIDER_UNAVAILABLE');
      expect((error as VisionTransferError).status).toBe(429);
      expect(JSON.stringify(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(providerPayload);
    }
  });

  it('aborts on timeout and clears the owned buffer', async () => {
    const image = Buffer.from('timeout-image');
    const fetchMock = jest.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }));

    await expectTransferCode(
      executeControlledVisionTransfer({ ...validInput(image), timeoutMs: 5 }, fetchMock),
      'VISION_TRANSFER_TIMEOUT',
    );
    expect(image.every((byte) => byte === 0)).toBe(true);
  });

  it('propagates caller cancellation as a controlled error and clears the buffer', async () => {
    const image = Buffer.from('cancelled-image');
    const controller = new AbortController();
    const fetchMock = jest.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        controller.abort(new Error('caller-private-reason'));
      }));

    await expectTransferCode(
      executeControlledVisionTransfer({ ...validInput(image), externalSignal: controller.signal }, fetchMock),
      'VISION_TRANSFER_CANCELLED',
    );
    expect(image.every((byte) => byte === 0)).toBe(true);
  });

  it('denies incomplete input without calling the provider and clears the buffer', async () => {
    const image = Buffer.from('denied-image');
    const fetchMock = jest.fn();
    await expectTransferCode(
      executeControlledVisionTransfer({ ...validInput(image), apiKey: '' }, fetchMock),
      'VISION_TRANSFER_DENIED',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(image.every((byte) => byte === 0)).toBe(true);
  });
});

function validInput(ownedImageBuffer: Buffer) {
  return {
    ownedImageBuffer,
    apiKey: 'test-api-key',
    model: 'test-model',
    prompt: 'Inspect only the supplied sanitized image.',
    timeoutMs: 1_000,
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function expectTransferCode(promise: Promise<unknown>, code: VisionTransferError['code']) {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(VisionTransferError);
    expect((error as VisionTransferError).code).toBe(code);
  }
}
