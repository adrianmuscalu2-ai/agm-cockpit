const ALLOWED_VISION_ENDPOINT = 'https://api.openai.com/v1/responses';

export type ControlledVisionTransferInput = {
  ownedImageBuffer: Buffer;
  apiKey: string;
  model: string;
  prompt: string;
  timeoutMs: number;
  externalSignal?: AbortSignal;
};

export type VisionTransferErrorCode =
  | 'VISION_TRANSFER_DENIED'
  | 'VISION_PROVIDER_UNAVAILABLE'
  | 'VISION_TRANSFER_TIMEOUT'
  | 'VISION_TRANSFER_CANCELLED';

export class VisionTransferError extends Error {
  constructor(readonly code: VisionTransferErrorCode, readonly status?: number) {
    super(code);
    this.name = 'VisionTransferError';
  }
}

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function executeControlledVisionTransfer(
  input: ControlledVisionTransferInput,
  fetchImplementation: FetchImplementation = fetch,
): Promise<unknown> {
  if (!input.apiKey || !input.model || !input.prompt || input.ownedImageBuffer.length === 0) {
    input.ownedImageBuffer.fill(0);
    throw new VisionTransferError('VISION_TRANSFER_DENIED');
  }

  const timeoutMs = Math.min(90_000, Math.max(1, Math.round(input.timeoutMs)));
  const controller = new AbortController();
  let timedOut = false;
  let requestBody: string | undefined;
  const abortFromCaller = () => controller.abort(input.externalSignal?.reason);
  input.externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  if (input.externalSignal?.aborted) abortFromCaller();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Vision transfer timeout.'));
  }, timeoutMs);

  try {
    requestBody = JSON.stringify({
      model: input.model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: input.prompt },
          {
            type: 'input_image',
            image_url: `data:image/png;base64,${input.ownedImageBuffer.toString('base64')}`,
            detail: 'high',
          },
        ],
      }],
    });

    const response = await fetchImplementation(ALLOWED_VISION_ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new VisionTransferError('VISION_PROVIDER_UNAVAILABLE', response.status);
    }
    return await response.json() as unknown;
  } catch (error) {
    if (error instanceof VisionTransferError) throw error;
    if (timedOut) throw new VisionTransferError('VISION_TRANSFER_TIMEOUT');
    if (controller.signal.aborted) throw new VisionTransferError('VISION_TRANSFER_CANCELLED');
    throw new VisionTransferError('VISION_PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
    input.externalSignal?.removeEventListener('abort', abortFromCaller);
    input.ownedImageBuffer.fill(0);
    requestBody = undefined;
  }
}
