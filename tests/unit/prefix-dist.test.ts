import { describe, expect, it } from 'vitest'

import { isRootPath, prefixUrls } from '../../scripts/prefix-dist.mjs'

describe('Pages 子路径改写', () => {
  it('页面链接、资源、数据与脚本路径都加上前缀', () => {
    expect(prefixUrls('<a href="/read">', '/tarot-site')).toBe('<a href="/tarot-site/read">')
    expect(prefixUrls('<a href="/cards">', '/tarot-site')).toBe('<a href="/tarot-site/cards">')
    expect(prefixUrls('<a href="/cards/major-00">', '/tarot-site')).toBe(
      '<a href="/tarot-site/cards/major-00">',
    )
    expect(prefixUrls('<link href="/_astro/a.css">', '/tarot-site')).toBe(
      '<link href="/tarot-site/_astro/a.css">',
    )
    expect(prefixUrls('"/img/cards/major-00.webp"', '/tarot-site')).toBe(
      '"/tarot-site/img/cards/major-00.webp"',
    )
    expect(prefixUrls('fetch("/data/cards.json")', '/tarot-site')).toBe(
      'fetch("/tarot-site/data/cards.json")',
    )
    expect(prefixUrls('`/cards/${id}`', '/tarot-site')).toBe('`/tarot-site/cards/${id}`')
    expect(prefixUrls('url(/img/cards/a.webp)', '/tarot-site')).toBe(
      'url(/tarot-site/img/cards/a.webp)',
    )
    expect(prefixUrls("register('/sw.js')", '/tarot-site')).toBe("register('/tarot-site/sw.js')")
    expect(prefixUrls('href="/"', '/tarot-site')).toBe('href="/tarot-site/"')
    expect(prefixUrls('"/icon-192.png"', '/tarot-site')).toBe('"/tarot-site/icon-192.png"')
    expect(prefixUrls('"/scripts/register-sw.js"', '/tarot-site')).toBe(
      '"/tarot-site/scripts/register-sw.js"',
    )
  })

  it('绝不动 JS 里的正则字面量（上一版就是在这里出的事故）', () => {
    const cases = [
      'e.replace(/\\s+/g, "")',
      't.replace(/。$/, "")',
      'e.split(/(?<=[。！？])/)',
      'normalize().replace(/[\\s，。！？、,.!?;:;:"\'“”‘’（）()\\-_/]/g, "")',
      'const m = /(a|b)/.exec(t)',
      'text.replace(/[&<>"\']/g, (c) => c)',
    ]
    for (const code of cases) {
      expect(prefixUrls(code, '/tarot-site'), code).toBe(code)
    }
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

  it('不在白名单里的路径一律不动', () => {
    for (const candidate of ['/\\s+', '/(', '/[', '/。$', '/undefined', '/etc/passwd', '/tarot']) {
      expect(isRootPath(candidate), candidate).toBe(false)
    }
    expect(isRootPath('/read')).toBe(true)
    expect(isRootPath('/read/')).toBe(true)
    expect(isRootPath('/')).toBe(true)
  })

  it('已经带前缀的不会重复加', () => {
    expect(prefixUrls('"/tarot-site/read"', '/tarot-site')).toBe('"/tarot-site/read"')
  })

  it('前缀为空时原样返回，末尾多余的斜杠会被规范掉', () => {
    expect(prefixUrls('<a href="/read">', '')).toBe('<a href="/read">')
    expect(prefixUrls('<a href="/read">', '/tarot-site/')).toBe('<a href="/tarot-site/read">')
  })
})
