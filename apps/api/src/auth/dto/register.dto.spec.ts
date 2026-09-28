import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RegisterDto } from "./register.dto";

describe("RegisterDto", () => {
  /**
   * Both assertions are set here, and the reason is worth stating because the first
   * case below asserts zero errors: an incomplete DTO would make that assertion be
   * about the missing fields rather than the password rule it is named for.
   */
  function buildDto(password: string): RegisterDto {
    const dto = new RegisterDto();
    dto.email = "owner@example.com";
    dto.name = "Owner Example";
    dto.password = password;
    dto.terms_accepted = true;
    dto.age_confirmed = true;
    return dto;
  }

  it("accepts generated passwords with caret special characters", async () => {
    const errors = await validate(buildDto("mX5x^^s!bW^Bt%8prR6N!"));

    expect(errors).toHaveLength(0);
  });

  it("rejects passwords without special characters", async () => {
    const errors = await validate(buildDto("Password12345"));

    expect(errors.some((error) => error.property === "password")).toBe(true);
  });

  /*
   * Two layers, and which one catches what is the whole story.
   *
   * `@IsBoolean()` fails on `undefined` and happily accepts `false`, so the
   * validator's job here is to refuse an *absent* assertion — a hand-rolled request
   * or a client older than the field. `false` is a well-formed boolean carrying a
   * refusal, and the thing that reads it is `auth.service.ts:register()`; the
   * refusal cases are tested there, not here. Testing `false` against the
   * validator would assert a guarantee this layer does not make.
   */

  it("rejects a registration that omits the adult assertion entirely", async () => {
    const dto = buildDto("mX5x^^s!bW^Bt%8prR6N!");
    delete (dto as Partial<RegisterDto>).age_confirmed;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "age_confirmed")).toBe(true);
  });

  it("rejects a registration that omits terms acceptance entirely", async () => {
    const dto = buildDto("mX5x^^s!bW^Bt%8prR6N!");
    delete (dto as Partial<RegisterDto>).terms_accepted;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "terms_accepted")).toBe(true);
  });

  it("coerces the string form an HTML checkbox posts", async () => {
    /*
     * Through `plainToInstance`, not a bare `validate(dto)`.
     *
     * `@Transform` runs during the class-transformer step, so calling `validate` on
     * an already-built instance skips it entirely and the string survives to fail
     * `@IsBoolean()`. The only path a real request takes is ValidationPipe's
     * `plainToInstance` -> `validate`, so that is the path under test.
     */
    const instance = plainToInstance(RegisterDto, {
      email: "owner@example.com",
      name: "Owner Example",
      password: "mX5x^^s!bW^Bt%8prR6N!",
      terms_accepted: "true",
      age_confirmed: "true",
    });

    expect(instance.terms_accepted).toBe(true);
    expect(instance.age_confirmed).toBe(true);
    expect(await validate(instance)).toHaveLength(0);
  });
});
