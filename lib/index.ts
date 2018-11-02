import axios, { AxiosInstance, AxiosPromise, AxiosRequestConfig } from "axios";
import { format, parse } from "url";
import { snakeCase, camelCase, pickBy } from "lodash";
import { stringify } from "querystring";

const API_ENDPOINT = "https://api.dribbble.com/v2";
const OAUTH_ENDPOINT = "https://dribbble.com/oauth";
const OAUTH_URI = parse(OAUTH_ENDPOINT);

export interface Pager {
  page: number;
  perPage: number;
}

export enum EnumScope {
  PUBLIC = "pulic",
  UPLOAD = "upload"
}

export interface Client {
  clientId: string;
  clientSecret: string;
  scope: string;
}

function snakePipe(data: any) {
  const ret: any = {};

  Object.keys(pickBy(data)).forEach(key => {
    ret[snakeCase(key)] = data[key];
  });

  return ret;
}

function camelPipe(data: any) {
  const ret: any = {};

  Object.keys(data).forEach(key => {
    ret[camelCase(key)] = data[key];
  });
  return ret;
}

// How to extends Error? https://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax-babel
export class DribbbleError extends Error {
  private code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}

export default class Dribbble {
  private accessToken: string;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private client: AxiosInstance;

  constructor(clientConfig: Client) {
    this.clientId = clientConfig.clientId;
    this.clientSecret = clientConfig.clientSecret;
    this.scope = clientConfig.scope;
    this.accessToken = "";

    this.client = axios.create({
      baseURL: API_ENDPOINT,
      headers: {
        post: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      },
      transformRequest: [snakePipe, data => stringify(data)]
    });

    this.client.interceptors.response.use(
      function(response) {
        return camelPipe(response.data);
      },
      function(error) {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Private function to ensure authorized.
   * TODO: use descorator?
   */
  private enforceAuthorized() {
    if (!this.accessToken) {
      throw new DribbbleError("Need authorization.", 403);
    }
  }

  private makeRequest(options: AxiosRequestConfig) {
    return this.client;
  }

  /**
   * Get dribbble authorization url, you should redirect user to the url.
   * @param scope
   * @param redirectUri
   * @param state
   */
  public getAuthorizationUrl(
    scope?: string,
    redirectUri?: string,
    state?: string
  ): string {
    const query = snakePipe({
      clientId: this.clientId,
      scope: scope || this.scope,
      redirectUri,
      state
    });

    return format({
      ...OAUTH_URI,
      pathname: "/oauth/authorize",
      query
    });
  }

  /**
   * Exchange access token with code
   * @param code
   */
  public exchangeAuthorizationCode(code: string, redirectUri?: string) {
    return this.client.post(`${OAUTH_ENDPOINT}/token`, {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      code,
      redirectUri: redirectUri
    });
  }

  /**
   * Set the client's token
   * @param accessToken access token returned by Dribbble
   */
  public setAccessToken(accessToken: string) {
    this.accessToken = accessToken;
    this.client.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${accessToken}`;
  }

  /**
   * Create an attachment
   * @param shot shot's id
   * @param file image your gonna to upload, limit 10M
   */
  public createAttachment(id: string, file: Buffer) {
    this.enforceAuthorized();
    return this.client.post(`/shots/${id}/attachments`, {
      file
    });
  }

  /**
   * Delete an attachment
   * @param shot shot's id
   * @param id attachment's id
   */
  public deleteAttachment(id: string, attachmentId: string) {
    this.enforceAuthorized();
    return this.client.delete(`/shots/${id}/attachments/${attachmentId}`);
  }

  /**
   * List the authenticated user’s liked shots
   * @param params
   */
  public getLikes(params: Pager) {
    this.enforceAuthorized();
    return this.client.get("/user/likes", {
      params
    });
  }

  /**
   * Check if user like a shot
   * @param id shot's id
   */
  public hasLiked(id: string) {
    this.enforceAuthorized();
    return this.client.get(`/shots/${id}/like`);
  }

  /**
   * Like a shot
   * @param id shot's id
   */
  public likeShot(id: string) {
    this.enforceAuthorized();
    return this.client.post(`/shots/${id}/like`);
  }

  /**
   * Unlike a shot
   * @param id shot's id
   */
  public unlikeShot(id: string) {
    return this.client.delete(`/shots/${id}/like`);
  }

  /**
   * List the authenticated user’s projects
   * @param params
   */
  public getUserProject(params: Pager) {
    this.enforceAuthorized();
    return this.client.get("/user/project", {
      params
    });
  }

  /**
   * Create a project
   * @param name project's name
   * @param description project's description
   */
  public createProject(name: string, description: string) {
    this.enforceAuthorized();
    return this.client.post("/projects", {
      name,
      description
    });
  }

  /**
   * Update a project
   * @param id project's id
   * @param data project's name and description
   */
  public updateProject(id: string, data: any) {
    this.enforceAuthorized();
    return this.client.post(`/projects/${id}`, data);
  }

  /**
   * Delete a project
   * @param id project's id
   */
  public deleteProject(id: string) {
    this.enforceAuthorized();
    return this.client.delete(`/projects/${id}`);
  }

  /**
   * List the authenticated user’s shots.
   * @param params
   */
  public getUserShots(params: Pager) {
    this.enforceAuthorized();
    return this.client.get("/user/shots", {
      params
    });
  }

  /**
   * List currently popular shots
   * @param params
   */
  public getPopularShots(params: Pager) {
    return this.client.get("/popular_shots", {
      params
    });
  }

  /**
   * Get a shot
   * @param id shot's id
   */
  public getShot(id: string) {
    return this.client.get(`/shots/${id}`);
  }

  /**
   * Create a shot
   * @param data shot's data
   */
  public createShot(data: any) {
    this.enforceAuthorized();
    return this.client.post("/shots", data);
  }

  /**
   * Update a shot
   * @param id shot's id
   * @param data shot's data
   */
  public updateShot(id: string, data: any) {
    this.enforceAuthorized();
    return this.client.post(`/shots/${id}`, data);
  }

  /**
   * Delete a shot
   * @param id shot's id
   */
  public deleteShot(id: string) {
    this.enforceAuthorized();
    return this.client.delete(`/shots/${id}`);
  }

  /**
   * Get authorized user profile
   */
  public getProfile() {
    this.enforceAuthorized();
    return this.client.get("/user");
  }
}
