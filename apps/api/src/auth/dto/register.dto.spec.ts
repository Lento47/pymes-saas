import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  function buildDto(password: string): RegisterDto {
    const dto = new RegisterDto();
    dto.email = 'owner@example.com';
    dto.name = 'Owner Example';
    dto.password = password;
    return dto;
  }

  it('accepts generated passwords with caret special characters', async () => {
    const errors = await validate(buildDto('mX5x^^s!bW^Bt%8prR6N!'));

    expect(errors).toHaveLength(0);
  });

  it('rejects passwords without special characters', async () => {
    const errors = await validate(buildDto('Password12345'));

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
