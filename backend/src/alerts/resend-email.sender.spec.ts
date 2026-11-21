import { AppConfigService } from '../config/app-config.service';
import { ResendEmailSender } from './resend-email.sender';

describe('ResendEmailSender', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  function sender(resendApiKey?: string) {
    return new ResendEmailSender({
      resendApiKey,
      alertsEmailFrom: 'Odell <avisos@odell.test>',
    } as AppConfigService);
  }

  it('sin RESEND_API_KEY no llama a Resend', async () => {
    await sender().send({ to: 'isaias@odell.test', subject: 'x', text: 'x' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con key manda el email con Bearer', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sender('re_test').send({
      to: 'isaias@odell.test',
      subject: 'Saldos',
      text: 'hola',
      html: '<p>hola</p>',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
        }) as unknown,
      }),
    );
  });
});
