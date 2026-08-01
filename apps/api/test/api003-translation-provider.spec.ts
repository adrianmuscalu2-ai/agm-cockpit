import { ConfigService } from '@nestjs/config';
import { OpenAiTranslationProvider } from '../src/translation/openai-translation.provider';
import { TRANSLATION_CONTRACT } from '../src/translation/translation.contract';
import { TranslationService } from '../src/translation/translation.service';

describe('API-003 Translation & AI Provider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('short-circuits equal languages without calling the provider', async () => {
    const provider = { translate: jest.fn() };
    const service = new TranslationService(provider as never);
    await expect(service.translateText({ text: 'Salut', sourceLanguage: 'ro', targetLanguage: 'ro' }))
      .resolves.toEqual({ text: 'Salut', available: true, provider: 'openai' });
    expect(provider.translate).not.toHaveBeenCalled();
  });

  it('caches a successful functional health probe', async () => {
    const provider = { translate: jest.fn().mockResolvedValue({ text: 'Betriebsprüfung', available: true, provider: 'openai' }) };
    const service = new TranslationService(provider as never);
    await expect(service.functionalHealth()).resolves.toMatchObject({ status: 'available', functional: true });
    await expect(service.functionalHealth()).resolves.toMatchObject({ status: 'available', functional: true });
    expect(provider.translate).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the provider secret is absent', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const provider = new OpenAiTranslationProvider(new ConfigService({}));
    await expect(provider.translate({ text: 'Salut', sourceLanguage: 'ro', targetLanguage: 'de' }))
      .resolves.toEqual({ text: 'Salut', available: false, provider: 'unavailable' });
  });

  it('uses the governed endpoint/model and returns provider output', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ output_text: 'Guten Tag' }),
    } as unknown as Response);
    const provider = new OpenAiTranslationProvider(new ConfigService({ OPENAI_API_KEY: 'secret' }));
    await expect(provider.translate({ text: 'Bună ziua', sourceLanguage: 'ro', targetLanguage: 'de' }))
      .resolves.toEqual({ text: 'Guten Tag', available: true, provider: 'openai' });
    expect(fetchMock).toHaveBeenCalledWith(TRANSLATION_CONTRACT.endpoint, expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      model: TRANSLATION_CONTRACT.defaultModel,
      temperature: 0,
    });
  });

  it('does not log provider messages or source text on an HTTP failure', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        error: { type: 'invalid_request_error', code: 'bad_request', message: 'Sensitive cargo text' },
      })),
    } as unknown as Response);
    const provider = new OpenAiTranslationProvider(new ConfigService({ OPENAI_API_KEY: 'secret' }));
    await provider.translate({ text: 'Private transport details', sourceLanguage: 'en', targetLanguage: 'de' });
    const logged = errorLog.mock.calls.flat().join(' ');
    expect(logged).toContain('invalid_request_error');
    expect(logged).not.toContain('Sensitive cargo text');
    expect(logged).not.toContain('Private transport details');
  });
});
