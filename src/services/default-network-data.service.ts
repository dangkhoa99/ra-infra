import isEmpty from 'lodash/isEmpty';
import {
  AnyType,
  App,
  GetListVariants,
  IGetRequestPropsParams,
  IGetRequestPropsResult,
  LocalStorageKeys,
  RequestBodyTypes,
  RequestMethods,
  RequestTypes,
  TGetListVariant,
  TRequestMethod,
  TRequestType,
} from '../common';
import { getError } from '../utilities';
import { BaseNetworkRequestService } from './base-network-request.service';

export class DefaultNetworkRequestService extends BaseNetworkRequestService {
  protected authToken?: { type?: string; value: string };
  protected noAuthPaths?: string[];
  protected headers?: HeadersInit;
  protected getListVariant?: TGetListVariant;

  constructor(opts: {
    name: string;
    baseUrl?: string;
    headers?: HeadersInit;
    noAuthPaths?: string[];
    getListVariant?: TGetListVariant;
  }) {
    const { name, baseUrl, headers, noAuthPaths, getListVariant } = opts;
    super({ name, scope: DefaultNetworkRequestService.name, baseUrl });

    this.headers = headers;
    this.noAuthPaths = noAuthPaths;
    this.getListVariant = getListVariant;
  }

  //-------------------------------------------------------------
  getGetListVariant() {
    return this.getListVariant;
  }

  //-------------------------------------------------------------
  getRequestAuthorizationHeader() {
    const authToken =
      this.authToken ||
      JSON.parse(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN) || '{}');

    if (!authToken?.value) {
      throw getError({
        message: '[dataProvider][getAuthHeader] Invalid auth token to fetch!',
        statusCode: 401,
      });
    }

    return `${authToken?.type || 'Bearer'} ${authToken.value}`;
  }

  //-------------------------------------------------------------
  setAuthToken(opts: { type?: string; value: string }) {
    const { type, value } = opts;
    this.authToken = { type, value };
  }

  //-------------------------------------------------------------
  getRequestHeader(opts: { resource: string }) {
    const { resource } = opts;

    const defaultHeaders = {
      ['Timezone']: App.TIMEZONE,
      ['Timezone-Offset']: `${App.TIMEZONE_OFFSET}`,
      ...this.headers,
    };

    if (this.noAuthPaths?.includes(resource)) {
      return defaultHeaders;
    }

    const authHeader = this.getRequestAuthorizationHeader();

    return { ...defaultHeaders, ['Authorization']: authHeader };
  }

  //-------------------------------------------------------------
  getRequestProps(params: IGetRequestPropsParams) {
    const { bodyType, body, file, resource } = params;
    const headers = this.getRequestHeader({ resource });

    const rs: IGetRequestPropsResult = { headers, body };

    switch (bodyType) {
      case RequestBodyTypes.FORM_URL_ENCODED: {
        rs.headers = {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        };

        const formData = new FormData();

        for (const key in body) {
          if (!body[key]) {
            continue;
          }
          formData.append(key, body[key]);
        }

        rs.body = formData;

        break;
      }
      case RequestBodyTypes.FORM_DATA: {
        rs.headers = headers;

        const formData = new FormData();

        if (file) {
          formData.append('file', file, file.name);
        }

        rs.body = formData;

        break;
      }
      default: {
        rs.headers = {
          ...headers,
          'Content-Type': 'application/json',
        };
        rs.body = body;
        break;
      }
    }

    return rs;
  }

  //-------------------------------------------------------------
  convertResponse<TData = AnyType>(opts: {
    response: { data: TData; headers: Record<string, any> };
    type: string;
  }): { data: TData; total?: number } {
    const {
      response: { data, headers },
      type,
    } = opts;

    switch (type) {
      case RequestTypes.GET_LIST:
      case RequestTypes.GET_MANY_REFERENCE: {
        const _data = !Array.isArray(data) ? [data] : data;

        if (this.getListVariant === GetListVariants.CONTENT_RANGE) {
          // content-range: <unit> <range-start>-<range-end>/<size>
          const contentRange =
            headers?.get('content-range') || headers?.get['Content-Range'];

          if (!contentRange) {
            throw getError({
              message:
                'Missing "Content-Range" header in the HTTP Response. The REST data provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. In case CORS, did you declare Content-Range in the Access-Control-Expose-Headers header?',
            });
          }

          return {
            data: _data as TData,
            total: parseInt(contentRange.split('/').pop(), 10) || _data.length,
          };
        }

        return { data: _data as TData };
      }
      default: {
        return { data };
      }
    }
  }

  //-------------------------------------------------------------
  async doRequest<ReturnType = AnyType>(
    opts: IGetRequestPropsResult & {
      baseUrl?: string;
      query?: any;
      type: TRequestType;
      method: TRequestMethod;
      paths: string[];
    },
  ): Promise<{ data: ReturnType; total?: number }> {
    const { baseUrl = this.baseUrl, type, method, paths, body, headers, query } = opts;

    if (!baseUrl || isEmpty(baseUrl)) {
      throw getError({
        message: '[doRequest] Invalid baseUrl to send request!',
      });
    }

    const url = this.getRequestUrl({ baseUrl, paths });

    const rs = await this.networkService.send({
      url,
      method,
      params: query,
      body: method === RequestMethods.GET ? undefined : body,
      headers,
      configs: {},
    });

    const jsonRs = await rs.json();

    if (jsonRs?.error) {
      throw getError(jsonRs?.error);
    }

    const status = rs.status;

    let tempRs: {
      response: { data: ReturnType; headers: Record<string, any> };
      type: string;
    } = {
      response: { data: {} as ReturnType, headers: rs.headers ?? {} },
      type,
    };

    switch (status) {
      case 204: {
        tempRs = { ...tempRs, response: { ...tempRs.response, data: {} as ReturnType } };
        break;
      }
      default: {
        if (
          [rs.headers?.get('content-type'), rs.headers?.get('Content-Type')].includes(
            'application/octet-stream',
          )
        ) {
          const blob = await rs.blob();

          tempRs = {
            ...tempRs,
            response: { ...tempRs.response, data: blob as ReturnType },
          };

          break;
        }

        tempRs = {
          ...tempRs,
          response: { ...tempRs.response, data: jsonRs as ReturnType },
        };

        break;
      }
    }

    const _rs = this.convertResponse<ReturnType>(tempRs);
    return _rs;
  }
}
