import { describe, expect, it } from 'vitest'

import { prefixUrls } from '../../scripts/prefix-dist.mjs'

describe('Pages 子路径改写', () => {
  it('根路径统一加上前缀', () => {
    expect(prefixUrls('<a href="/read">', '/tarot-site')).toBe('<a href="/tarot-site/read">')
    expect(prefixUrls('<link href="/_astro/a.css">', '/tarot-site')).toBe(
      '<link href="/tarot-site/_astro/a.css">',
    )
    expect(prefixUrls('fetch("/data/cards.json")', '/tarot-site')).toBe(
      'fetch("/tarot-site/data/cards.json")',
    )
    expect(prefixUrls('`/cards/${id}`', '/tarot-site')).toBe('`/tarot-site/cards/${id}`')
    expect(prefixUrls('url(/img/cards/a.webp)', '/tarot-site')).toBe(
      'url(/tarot-site/img/cards/a.webp)',
    )
    expect(prefixUrls("register('/sw.js')", '/tarot-site')).toBe("register('/tarot-site/sw.js')")
  })

  it('只改路径开头的一处，中间的斜杠不动', () => {
    expect(prefixUrls('"/img/cards/major-00.webp"', '/tarot-site')).toBe(
      '"/tarot-site/img/cards/major-00.webp"',
    )
  })

  it('协议相对地址、http(s) 与结束标签都不动', () => {
    expect(prefixUrls('<script src="//cdn.example.com/a.js"></script>', '/tarot-site')).toBe(
      '<script src="//cdn.example.com/a.js"></script>',
    )
    expect(prefixUrls('https://github.com/3-dd-del/tarot-site', '/tarot-site')).toBe(
      'https://github.com/3-dd-del/tarot-site',
    )
    expect(prefixUrls('</script>', '/tarot-site')).toBe('</script>')
    expect(prefixUrls('a / b', '/tarot-site')).toBe('a / b')
  })

  it('前缀为空时原样返回，末尾多余的斜杠会被规范掉', () => {
    expect(prefixUrls('<a href="/read">', '')).toBe('<a href="/read">')
    expect(prefixUrls('<a href="/read">', '/tarot-site/')).toBe('<a href="/tarot-site/read">')
  })
})
