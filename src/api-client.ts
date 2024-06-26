import axios, { AxiosInstance } from 'axios'
import { ApiContent } from './api-content.js'
import { ListApiResponse, ListApiResponseInJson } from './api-response.js'
import { ConstructorFromJson, JsonType } from './json-utils.js'
import { QueryParameters } from './query.js'

/**
 * hacoCMS の API クライアント
 */
export class HacoCmsClient {
  private readonly axios: AxiosInstance

  // 下書き取得用
  private readonly axiosDraft?: AxiosInstance

  /**
   * @param baseURL API のベース URL `https://{プロジェクトのサブドメイン}.hacocms.com/`
   * @param accessToken プロジェクトの Access-Token
   * @param projectDraftToken _(optional)_ プロジェクトの Project-Draft-Token
   */
  constructor(baseURL: string, accessToken: string, projectDraftToken?: string) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    }
    // biome-ignore lint/style/noParameterAssign: this assignment is intended to shadow
    baseURL = new URL('/api/v1/', baseURL).toString()
    this.axios = axios.create({
      baseURL,
      headers,
    })

    if (projectDraftToken) {
      this.axiosDraft = axios.create({
        baseURL,
        headers: {
          ...headers,
          'Haco-Project-Draft-Token': projectDraftToken,
        },
      })
    }
  }

  /**
   * コンテンツの一覧を取得します。
   * {@link https://hacocms.com/references/content-api#tag/%E3%82%B3%E3%83%B3%E3%83%86%E3%83%B3%E3%83%84/paths/~1api~1v1~1%7Bendpoint%7D/get}
   *
   * @param Constructor コンテンツの JSON オブジェクトを引数とするコンストラクタを持つクラスオブジェクト
   * @param endpoint リスト形式 API のエンドポイント
   * @param query クエリパラメータ
   * @returns API のレスポンスボディ
   */
  async getList<ApiSchema extends ApiContent>(Constructor: ConstructorFromJson<ApiSchema>, endpoint: string, query: Partial<QueryParameters> = {}) {
    const res = await this.axios.get<ListApiResponseInJson<ApiSchema>>(endpoint, {
      params: query,
    })
    return new ListApiResponse(res.data, Constructor)
  }

  /**
   * コンテンツの一覧を下書きを含めて取得します。
   * {@link https://hacocms.com/references/content-api#tag/%E3%82%B3%E3%83%B3%E3%83%86%E3%83%B3%E3%83%84/paths/~1api~1v1~1%7Bendpoint%7D/get}
   *
   * @param Constructor コンテンツの JSON オブジェクトを引数とするコンストラクタを持つクラスオブジェクト
   * @param endpoint リスト形式 API のエンドポイント
   * @param query クエリパラメータ
   * @returns API のレスポンスボディ
   */
  async getListIncludingDraft<ApiSchema extends ApiContent>(Constructor: ConstructorFromJson<ApiSchema>, endpoint: string, query: Partial<QueryParameters> = {}) {
    if (!this.axiosDraft) {
      throw new Error('need Project-Draft-Token to get draft contents')
    }

    const res = await this.axiosDraft.get<ListApiResponseInJson<ApiSchema>>(endpoint, {
      params: query,
    })
    return new ListApiResponse(res.data, Constructor)
  }

  /**
   * シングル形式 API のコンテンツを取得します。
   * {@link https://hacocms.com/references/content-api#tag/%E3%82%B3%E3%83%B3%E3%83%86%E3%83%B3%E3%83%84/paths/~1api~1v1~1%7Bendpoint%7D/get}
   *
   * @param Constructor コンテンツの JSON オブジェクトを引数とするコンストラクタを持つクラスオブジェクト
   * @param endpoint シングル形式 API のエンドポイント
   * @returns コンテンツのオブジェクト（`Constructor` 型）
   */
  async getSingle<ApiSchema extends ApiContent>(Constructor: ConstructorFromJson<ApiSchema>, endpoint: string) {
    const axios = this.axiosDraft ?? this.axios
    const res = await axios.get<JsonType<ApiSchema>>(endpoint)
    return new Constructor(res.data)
  }

  /**
   * 指定したコンテンツを取得します。
   * {@link https://hacocms.com/references/content-api#tag/%E3%82%B3%E3%83%B3%E3%83%86%E3%83%B3%E3%83%84/paths/~1api~1v1~1%7Bendpoint%7D~1%7Bcontent_id%7D/get}
   *
   * @param Constructor コンテンツの JSON オブジェクトを引数とするコンストラクタを持つクラスオブジェクト
   * @param endpoint API のエンドポイント
   * @param id コンテンツ ID
   * @param draftToken _(optional)_ 未公開コンテンツを取得するためのトークン
   * @returns コンテンツのオブジェクト（`Constructor` 型）
   */
  async getContent<ApiSchema extends ApiContent>(Constructor: ConstructorFromJson<ApiSchema>, endpoint: string, id: string, draftToken?: string) {
    const axios = this.axiosDraft ?? this.axios
    const params = draftToken ? { draft: draftToken } : {}
    const res = await axios.get<JsonType<ApiSchema>>(`${endpoint}/${id}`, { params })
    return new Constructor(res.data)
  }
}
