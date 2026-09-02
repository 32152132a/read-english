import { ConfigService } from '@nestjs/config';
import { CosService } from './cos.service';

describe('CosService', () => {
  const service = new CosService(new ConfigService());

  it('creates an unpredictable object key with a safe extension', () => {
    const key = service.createObjectKey('recordings', '.MP3');

    expect(key).toMatch(/^recordings\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.mp3$/);
  });
});
