import http from 'http'
import { AddressInfo } from 'net'
import { HacoCmsClient as BaseClient } from './api-client'
import { ApiContent } from './api-content'

class DummyApiContent extends ApiContent {}

// to just publish the protected methods
class HacoCmsClient extends BaseClient {
  getList = super.getList
  getListIncludingDraft = super.getListIncludingDraft
  getSingle = super.getSingle
  getContent = super.getContent
}

const dummyAccessToken = 'DUMMY_ACCESS_TOKEN'
const dummyProjectDraftToken = 'DUMMY_PROJECT_DRAFT_TOKEN'
const dummyEndpoint = '/dummy'
const dummyResponse = JSON.stringify({
  meta: { total: 0, offset: 0, limit: 100 },
  data: [],
})

describe('getList', () => {
  test('get public data', async () => {
    const dateStr = '2022-03-08T12:00:00.000+09:00'
    const expectedTime = Date.parse(dateStr)
    const stubServer = await makeStubServer([
      {
        meta: {
          total: 1,
          offset: 0,
          limit: 100,
        },
        data: [
          {
            id: 'abcdef',
            createdAt: dateStr,
            updatedAt: dateStr,
            publishedAt: dateStr,
            closedAt: null,
          },
        ],
      },
    ])

    const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken)
    const res = await client.getList(DummyApiContent, dummyEndpoint)

    expect(res).toHaveProperty('meta')
    expect(res).toHaveProperty('data')

    const gotMeta = res.meta
    expect(gotMeta.total).toBe(1)
    expect(gotMeta.offset).toBe(0)
    expect(gotMeta.limit).toBeGreaterThan(0)

    const gotData = res.data[0]
    expect(gotData).toBeInstanceOf(DummyApiContent)
    expect(gotData.id).toBe('abcdef')
    expect(gotData.createdAt.getTime()).toBe(expectedTime)
    expect(gotData.updatedAt.getTime()).toBe(expectedTime)
    expect(gotData.publishedAt?.getTime()).toBe(expectedTime)
    expect(gotData.closedAt).toBeNull()

    stubServer.close()
  })

  describe('query parameters are appended to query string', () => {
    const listener = (params: Map<string, string>) => (req: http.IncomingMessage, res: http.ServerResponse) => {
      new URL(req.url!, 'http://localhost/').searchParams.forEach((value, key) => {
        params.set(key, value)
      })
      res.end(dummyResponse)
    }

    test.each([
      ['limit', 50],
      ['offset', 100],
      ['s', 'createdAt'],
      ['s', '-publishedAt,id'],
    ])('%s', async (key, param) => {
      const gotQueryParameters = new Map<string, string>()
      const stubServer = await createServer(listener(gotQueryParameters))
      const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken)
      await client.getList(DummyApiContent, dummyEndpoint, { [key]: param })

      expect(gotQueryParameters.get(key)).toBe(param.toString())

      stubServer.close()
    })
  })

  test('throw an error if API returns 401', async () => {
    const stubServer = await createServer((_, res: http.ServerResponse) => {
      res.writeHead(401, { 'Content-Type': 'text/plain' })
      res.end('Unauthorized')
    })

    const client = new HacoCmsClient(getServerUrl(stubServer), 'WRONG_ACCESS_TOKEN')
    await expect(client.getList(DummyApiContent, dummyEndpoint)).rejects.toThrow()

    stubServer.close()
  })
})

describe('getSingle', () => {
  test('get single content', async () => {
    const dateStr = '2022-03-08T12:00:00.000+09:00'
    const expectedTime = Date.parse(dateStr)
    const stubServer = await makeStubServer([
      {
        id: 'abcdef',
        createdAt: dateStr,
        updatedAt: dateStr,
        publishedAt: dateStr,
        closedAt: null,
      },
    ])

    const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken)
    const res = await client.getSingle(DummyApiContent, dummyEndpoint)

    expect(res).toBeInstanceOf(DummyApiContent)
    expect(res.id).toBe('abcdef')
    expect(res.createdAt.getTime()).toBe(expectedTime)
    expect(res.updatedAt.getTime()).toBe(expectedTime)
    expect(res.publishedAt?.getTime()).toBe(expectedTime)
    expect(res.closedAt).toBeNull()

    stubServer.close()
  })
})

describe('getListIncludingDraft', () => {
  test('request header has Haco-Project-Draft-Token with the value given by client constructor', async () => {
    let requestHeader: http.IncomingHttpHeaders = {}
    const spyHeader = (req: http.IncomingMessage, res: http.ServerResponse) => {
      requestHeader = req.headers
      res.end(dummyResponse)
    }
    const stubServer = await createServer(spyHeader)

    const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken, dummyProjectDraftToken)
    await client.getListIncludingDraft(DummyApiContent, dummyEndpoint)

    expect(requestHeader).toHaveProperty('Haco-Project-Draft-Token'.toLowerCase(), dummyProjectDraftToken)

    stubServer.close()
  })

  test('throw an error if client does not give Project-Draft-Token', async () => {
    const stubServer = await createServer((_, res: http.ServerResponse) => {
      res.writeHead(401, { 'Content-Type': 'text/plain' })
      res.end('Unauthorized')
    })

    const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken) // do not pass Project-Draft-Token
    await expect(client.getListIncludingDraft(DummyApiContent, dummyEndpoint)).rejects.toThrow(/Project-Draft-Token/i)

    stubServer.close()
  })
})

describe('getContent', () => {
  test('get specified content', async () => {
    const contentId = 'abcdef'
    const dateStr = '2022-03-08T12:00:00.000+09:00'
    const expectedTime = Date.parse(dateStr)
    const stubServer = await makeStubServer([
      {
        id: contentId,
        createdAt: dateStr,
        updatedAt: dateStr,
        publishedAt: dateStr,
        closedAt: null,
      },
    ])

    const client = new HacoCmsClient(getServerUrl(stubServer), dummyAccessToken)
    const res = await client.getContent(DummyApiContent, dummyEndpoint, contentId)

    expect(res).toBeInstanceOf(DummyApiContent)
    expect(res.id).toBe('abcdef')
    expect(res.createdAt.getTime()).toBe(expectedTime)
    expect(res.updatedAt.getTime()).toBe(expectedTime)
    expect(res.publishedAt?.getTime()).toBe(expectedTime)
    expect(res.closedAt).toBeNull()

    stubServer.close()
  })
})

async function createServer(listener: http.RequestListener) {
  const server = http.createServer(listener)
  server.listen(undefined, 'localhost')
  while (!server.address()) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return server
}

async function makeStubServer(responses: readonly unknown[]) {
  const generator = (function* () {
    for (const res of responses) {
      yield res
    }
  })()
  const server = await createServer((_, res: http.ServerResponse) => {
    const itr = generator.next()
    if (itr.done) {
      throw new Error('no more response!')
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.write(JSON.stringify(itr.value))
    res.end()
  })
  return server
}

function getServerUrl(server: http.Server) {
  const { address, port } = server.address() as AddressInfo
  return `http://${address}:${port}`
}
