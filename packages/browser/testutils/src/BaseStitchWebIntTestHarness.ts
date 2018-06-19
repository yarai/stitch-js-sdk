import { fail } from "assert";
import {
  MemoryStorage,
  Stitch,
  StitchAppClient,
  StitchAppClientConfiguration,
  UserPasswordAuthProviderClient,
  UserPasswordCredential
} from "mongodb-stitch-browser-core";
import { App, AppResponse } from "mongodb-stitch-core-admin-client";
import BaseStitchIntTestHarness from "mongodb-stitch-core-testutils";

const stitchBaseURLEnvVar = "STITCH_BASE_URL";

export default class BaseStitchWebIntTestHarness extends BaseStitchIntTestHarness {
  public readonly clients: StitchAppClient[] = [];

  public setup(): Promise<void> {
    return super.setup().then(() => {
      try {
        Stitch.initialize();
      } catch (error) {
        fail(error);
      }
    });
  }

  public tearDown(): Promise<void> {
    return super
      .teardown()
      .then(() =>
        Promise.all(
          this.clients.map(it => {
            it.auth.logout();
          })
        )
      )
      .then(() => {});
  }

  get stitchBaseUrl(): string {
    const envVar = process.env[stitchBaseURLEnvVar];
    return envVar !== undefined ? envVar : "http://localhost:9090";
  }

  public getAppClient(app: AppResponse): StitchAppClient {
    if (Stitch.hasAppClient(app.clientAppId)) {
      return Stitch.getAppClient(app.clientAppId);
    }

    const client = Stitch.initializeAppClient(
      new StitchAppClientConfiguration.Builder()
        .withClientAppId(app.clientAppId)
        .withBaseURL(this.stitchBaseUrl)
        .withStorage(new MemoryStorage(app.clientAppId))
    );
    this.clients.push(client);
    return client;
  }

  // Registers a new email/password user, and logs them in, returning the user's ID
  public async registerAndLoginWithUserPass(
    app: App,
    client: StitchAppClient,
    email: string,
    pass: string
  ): Promise<string> {
    const emailPassClient = client.auth.getProviderClient(
      UserPasswordAuthProviderClient.factory
    );

    return emailPassClient
      .registerWithEmail(email, pass)
      .then(() => app.userRegistrations.sendConfirmation(email))
      .then(conf => emailPassClient.confirmUser(conf.token, conf.tokenId))
      .then(() =>
        client.auth.loginWithCredential(new UserPasswordCredential(email, pass))
      )
      .then(user => user.id);
  }
}