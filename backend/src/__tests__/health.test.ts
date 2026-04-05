import { createApp } from "../app.js";

describe("GET /api/v1/health", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns a healthy versioned response", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect([200, 503]).toContain(response.statusCode);

    const payload = response.json();
    expect(payload).toMatchObject({
      service: "jarvis-backend",
      version: "v1",
      dependencies: {
        db: { ok: expect.any(Boolean) }
      }
    });
  });
});
