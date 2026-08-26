import { validate } from 'class-validator';
import { UpdateUserNickColorDto } from './update-user-nick-color.dto';

describe('UpdateUserNickColorDto', () => {
  it('accepts valid hex color', async () => {
    const dto = new UpdateUserNickColorDto();
    dto.nickColor = '#2563EB';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts null value', async () => {
    const dto = new UpdateUserNickColorDto();
    dto.nickColor = null;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid color format', async () => {
    const dto = new UpdateUserNickColorDto();
    dto.nickColor = 'blue';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
