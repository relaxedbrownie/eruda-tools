// ==UserScript==
// @name         Eruda + Elements 선택·복사·수정·검색
// @namespace    eruda-select-patch
// @version      1.6.0
// @description  페이지에 Eruda를 띄우고, Elements 탭의 글자를 길게 눌러 선택·복사할 수 있게 하며, ✎ 버튼으로 선택한 노드(HTML·속성·텍스트)를 직접 수정하고, 🔍 버튼으로 글자·속성·CSS 선택자를 검색할 수 있게 합니다. 톱니 버튼을 길게 누르면 숨기고(화면을 건드리면 잠깐 보였다 사라짐), 다시 길게 누르면 보입니다. 북마클릿으로 Eruda를 켜고 끌 수 있습니다. 진단 결과는 Eruda > Info 탭에 표시됩니다.
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.js
// @grant        none
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ───── 설정 ─────
  // true  : 이 스크립트가 Eruda를 직접 띄움 (보통은 이대로)
  // false : Eruda는 북마클릿 등 다른 방법으로 띄우고, 이 스크립트는 '선택 가능' 패치만 함
  //         (이 경우 실행 환경이 달라서 ✎ 수정 기능은 못 쓸 수 있음 — 진단에 표시됨)
  var LOAD_ERUDA = true;
  // 길게 눌러도 선택이 안 되는 기기가 있으면 false로 바꿔 보세요 (Eruda를 Shadow DOM 없이 띄움)
  var USE_SHADOW_DOM = true;

  var VERSION = '1.6.0';
  var TAG = '[Eruda 선택·수정·검색 v' + VERSION + ']';
  var STYLE_ID = 'eruda-select-patch-style';
  var EDITOR_ID = 'esp-editor';
  var SEARCH_ID = 'esp-search';
  // 아이콘 (선 굵기·크기 통일, 색은 Eruda 툴바 글자색을 따라감)
  var ICON_ATTR = 'viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var ICON_FIND = '<svg ' + ICON_ATTR + '><circle cx="6.9" cy="6.9" r="4.6"/><path d="M10.3 10.3 14 14"/></svg>';
  var ICON_EDIT = '<svg ' + ICON_ATTR + '><path d="M2.5 13.5 3.2 10.6 10.8 3 13 5.2 5.4 12.8Z"/><path d="M9.4 4.4 11.6 6.6"/></svg>';
  var SEARCH_MAX = 1000; // 결과가 너무 많으면 여기서 끊음 (휴대폰 성능)
  var LONG_PRESS_MS = 600; // 톱니 버튼을 이만큼 누르고 있으면 숨김/보이기
  var RING_DELAY_MS = 150; // 길게 누르기 진행 테두리는 이만큼 누른 뒤부터 보임 (짧은 탭에선 안 보이게)
  var PEEK_MS = 1000; // 숨긴 톱니: 화면을 건드리면 보였다가, 마지막으로 건드린 뒤 이만큼 지나면 다시 사라짐

  // Eruda 원본 CSS는 ".eruda-container * { user-select: none }"로 전부 막아 두고
  // 콘솔·네트워크 등 일부만 예외로 풀어 둠. Elements 탭은 예외에 없어서 선택이 안 됨.
  // → Elements 탭 안쪽만 다시 선택 가능하게 하고, 아이콘·버튼은 그대로 둠.
  var CSS = [
    '#eruda-elements, #eruda-elements * {',
    '  -webkit-user-select: text !important;',
    '  user-select: text !important;',
    '  -webkit-touch-callout: default !important;',
    '}',
    '#eruda-elements .eruda-control,',
    '#eruda-elements .eruda-control *,',
    '#eruda-elements [class*="eruda-icon"],',
    '#eruda-elements [class*="luna-dom-viewer-icon"],',
    '#eruda-elements .luna-dom-viewer-toggle,',
    '#eruda-elements .eruda-section h2 .eruda-btn,',
    '#eruda-elements .esp-btn, #eruda-elements .esp-head {',
    '  -webkit-user-select: none !important;',
    '  user-select: none !important;',
    '  -webkit-touch-callout: none !important;',
    '}',
    // 🔍·✎ 버튼: 같은 선 아이콘(16px) + 같은 누름 영역(32×40). 왼쪽 묶음은 32px 간격으로
    // 선택(가운데 18px) → 검색(50px) → 수정(82px) — Web Inspector 확장과 같은 배치
    '#eruda-elements .esp-find, #eruda-elements .esp-edit {',
    '  display: inline-block; position: absolute; top: 0; box-sizing: border-box; width: 32px; height: 40px;',
    '  padding: 12px 8px; line-height: 0; cursor: pointer; z-index: 1;',
    '}',
    '#eruda-elements .esp-find svg, #eruda-elements .esp-edit svg { display: block; width: 16px; height: 16px; }',
    '#eruda-elements .esp-find:active, #eruda-elements .esp-edit:active { opacity: .5; }',
    '#eruda-elements .eruda-elements > .eruda-control .esp-find { left: 34px; }',
    '#eruda-elements .eruda-elements > .eruda-control .esp-edit { left: 66px; }',
    '#eruda-elements .eruda-detail > .eruda-control .esp-edit { right: 34px; }',
    // 편집 창 — Eruda의 var(--background) 등은 Eruda가 자기 CSS를 넣을 때만 실제 색으로 바뀜(진짜 CSS 변수가 아님).
    // 그래서 편집 창은 열 때 Eruda 화면에서 실제 색을 읽어 --esp-* 로 넣어 씀 (어두운 테마도 따라감).
    '#' + EDITOR_ID + ' {',
    '  position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 30; display: flex; flex-direction: column;',
    '  background: var(--esp-bg, #fff); color: var(--esp-fg, #333); box-sizing: border-box;',
    '  padding-bottom: env(safe-area-inset-bottom);',
    '}',
    '#' + EDITOR_ID + ' .esp-head { flex: none; padding: 10px; font-size: 13px; line-height: 20px; background: var(--esp-dark, #f3f3f3); border-bottom: 1px solid var(--esp-border, #ccc); color: var(--esp-primary, #333); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }',
    // 입력칸 글자는 Elements 트리와 같은 크기로 보이게 함. 아이폰은 16px보다 작은 입력칸을 누르면 화면을 확대해 버려서
    // 글자 크기는 16px로 두고 입력칸 전체를 줄여 보이게 함 (--esp-ta-scale = 트리 글자 크기 ÷ 16, 보통 12px → 0.75)
    '#' + EDITOR_ID + ' .esp-ta-wrap { flex: 1; min-height: 0; position: relative; overflow: hidden; }',
    '#' + EDITOR_ID + ' textarea {',
    '  position: absolute; left: 0; top: 0; transform-origin: 0 0; transform: scale(var(--esp-ta-scale, .75));',
    '  width: calc(100% / var(--esp-ta-scale, .75)); height: calc(100% / var(--esp-ta-scale, .75));',
    '  box-sizing: border-box; margin: 0; padding: calc(8px / var(--esp-ta-scale, .75)) calc(10px / var(--esp-ta-scale, .75)); border: 0; border-radius: 0; outline: 0; resize: none;',
    '  font-family: var(--esp-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 16px; line-height: 1.3333; white-space: pre-wrap; word-break: break-all; overflow: auto;',
    '  background: var(--esp-bg, #fff); color: var(--esp-fg, #333); -webkit-appearance: none;',
    '}',
    '#' + EDITOR_ID + ' .esp-msg { flex: none; padding: 6px 10px; font-size: 12px; line-height: 16px; border-bottom: 1px solid var(--esp-border, #ccc); min-height: 16px; white-space: pre-wrap; }',
    '#' + EDITOR_ID + ' .esp-msg.esp-err { color: #e53935; }',
    '#' + EDITOR_ID + ' .esp-bar { flex: none; display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--esp-border, #ccc); background: var(--esp-dark, #f3f3f3); }',
    '#' + EDITOR_ID + ' .esp-btn { flex: 1; padding: 8px 0; font-size: 14px; text-align: center; border: 1px solid var(--esp-border, #ccc); border-radius: 4px; cursor: pointer; color: var(--esp-fg, #333); background: var(--esp-bg, #fff); }',
    '#' + EDITOR_ID + ' .esp-btn:active { background: var(--esp-hi, #eaeaea); }',
    '#' + EDITOR_ID + ' .esp-btn.esp-primary { color: #fff; background: var(--esp-accent, #1a73e8); border-color: var(--esp-accent, #1a73e8); }',
    '#' + EDITOR_ID + ' .esp-btn.esp-off { opacity: .4; }',
    // 🔍 검색 — 툴바 아래 두 번째 줄로 열림 (✎ 등 기존 버튼은 그대로 쓸 수 있게)
    '#eruda-elements .esp-find.esp-on { color: var(--esp-accent, #1a73e8); }',
    '#eruda-elements .eruda-elements.esp-searching { padding-top: 80px !important; }',
    '#' + SEARCH_ID + ' {',
    '  position: absolute; left: 0; top: 40px; width: 100%; height: 40px; box-sizing: border-box; z-index: 5;',
    '  display: flex; align-items: center; gap: 2px; padding: 0 4px 0 8px; font-size: 14px;',
    '  background: var(--esp-dark, #f3f3f3); color: var(--esp-fg, #333); border-bottom: 1px solid var(--esp-border, #ccc);',
    '}',
    '#' + SEARCH_ID + ' input {',
    '  flex: 1; min-width: 0; height: 28px; box-sizing: border-box; margin: 0; padding: 0 8px; font-size: 16px;',
    '  border: 1px solid var(--esp-border, #ccc); border-radius: 4px; outline: 0; -webkit-appearance: none;',
    '  background: var(--esp-bg, #fff); color: var(--esp-fg, #333);',
    '}',
    '#' + SEARCH_ID + ' input:focus { border-color: var(--esp-accent, #1a73e8); }',
    // 입력칸 기본 지우기(✕)는 숨김 — 오른쪽 닫기 ✕와 헷갈리지 않게
    '#' + SEARCH_ID + ' input::-webkit-search-cancel-button, #' + SEARCH_ID + ' input::-webkit-search-decoration { -webkit-appearance: none; display: none; }',
    '#' + SEARCH_ID + ' .esp-count { flex: none; min-width: 44px; padding: 0 4px; font-size: 12px; text-align: center; white-space: nowrap; }',
    '#' + SEARCH_ID + ' .esp-count.esp-none { color: #e53935; }',
    '#' + SEARCH_ID + ' .esp-sbtn { flex: none; padding: 8px 9px; font-size: 14px; line-height: 16px; cursor: pointer; }',
    '#' + SEARCH_ID + ' .esp-sbtn:active { opacity: .5; }',
    '#' + SEARCH_ID + ' .esp-sbtn.esp-off { opacity: .3; }',
    '#' + SEARCH_ID + ', #' + SEARCH_ID + ' .esp-count, #' + SEARCH_ID + ' .esp-sbtn { -webkit-user-select: none !important; user-select: none !important; }',
    '#' + SEARCH_ID + ' input { -webkit-user-select: text !important; user-select: text !important; }',
    // 톱니 버튼 숨김 — 안 보이게만 하고 자리는 그대로 (탭하면 Eruda 열고 닫기, 길게 누르면 다시 보임)
    '.eruda-entry-btn { -webkit-touch-callout: none !important; }',
    '.eruda-entry-btn.esp-gear-hidden, .eruda-entry-btn.esp-gear-hidden:active, .eruda-entry-btn.esp-gear-hidden.eruda-active { opacity: 0 !important; }',
    // 숨긴 톱니가 잠깐 보이는 동안 — Eruda 원래 투명도(평소 .3, 누를 때 .8)로 되돌림, 나타나고 사라질 때는 Eruda의 .3초 전환 효과를 그대로 씀
    '.eruda-entry-btn.esp-gear-hidden.esp-gear-peek { opacity: .3 !important; }',
    '.eruda-entry-btn.esp-gear-hidden.esp-gear-peek:active, .eruda-entry-btn.esp-gear-hidden.esp-gear-peek.eruda-active { opacity: .8 !important; }',
    // 길게 누르기 진행 테두리 — 누르는 동안 톱니 둘레가 차오르고, 다 차는 순간 숨김/보이기가 바뀜
    // (시작 지연·채우는 시간은 --esp-ring-delay / --esp-ring-dur 로 LONG_PRESS_MS와 맞춤)
    '.eruda-entry-btn .esp-ring { position: absolute; left: -5px; top: -5px; width: 50px; height: 50px; overflow: visible; pointer-events: none; opacity: 0; }',
    '.eruda-entry-btn .esp-ring rect { fill: none; stroke: var(--esp-accent, #1a73e8); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; }',
    '.eruda-entry-btn.esp-holding .esp-ring { opacity: 1; transition: opacity 0s linear var(--esp-ring-delay, .15s); }',
    '.eruda-entry-btn.esp-holding .esp-ring rect { animation: esp-ring-fill var(--esp-ring-dur, .45s) linear var(--esp-ring-delay, .15s) forwards; }',
    '@keyframes esp-ring-fill { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }',
    '.eruda-entry-btn.esp-hold-done .esp-ring { opacity: 1; }',
    '.eruda-entry-btn.esp-hold-done .esp-ring rect { stroke-dashoffset: 0; animation: none; }',
    // 바뀌는 순간 '톡' 커졌다 돌아오기
    '.eruda-entry-btn.esp-hold-pop { animation: esp-hold-pop .25s ease-out; }',
    '@keyframes esp-hold-pop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }'
  ].join('\n');

  var st = {
    source: '-',        // Eruda를 누가 띄웠는지
    initError: '',      // 초기화 실패 사유
    applyCount: 0,      // 패치 스타일을 넣은 횟수(호스트가 새로 생길 때마다 +1)
    observing: false,
    lastEdit: '없음',   // 마지막 수정 결과
    editCount: 0
  };
  var undoStack = [];   // 수정 되돌리기용 (최근 20개)

  function log() {
    try { console.log.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {}
  }

  function getEruda() {
    try { if (typeof eruda !== 'undefined' && eruda && typeof eruda.init === 'function') return eruda; } catch (e) {}
    try { if (window.eruda && typeof window.eruda.init === 'function') return window.eruda; } catch (e) {}
    return null;
  }

  function getHost() { return document.getElementById('eruda'); }
  function getRoot() { var h = getHost(); return h ? (h.shadowRoot || document) : null; }
  function q(sel) { var r = getRoot(); return r ? r.querySelector(sel) : null; }

  // ───── 1. 선택·복사: 스타일 삽입 ─────
  // Eruda 호스트(#eruda)의 shadowRoot(없으면 document.head)에 스타일 삽입.
  // DOM을 통해 넣기 때문에 Eruda가 다른 실행 환경(북마클릿 등)에서 떴어도 적용됨.
  function applyPatch() {
    var host = getHost();
    if (!host) return false;
    var root = host.shadowRoot || document.head || document.documentElement;
    if (!root.querySelector('#' + STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      root.appendChild(style);
      st.applyCount++;
    }
    addEditButtons();
    bindGear();
    fixIconFonts();
    fixConsoleLevels();
    return true;
  }

  // ───── 2. 수정: ✎ 버튼 ─────
  function addEditButtons() {
    var bars = [
      ['main', q('#eruda-elements .eruda-elements > .eruda-control')],
      ['detail', q('#eruda-elements .eruda-detail > .eruda-control')]
    ];
    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i][1];
      if (!bar || bar.querySelector('.esp-edit')) continue;
      var b = document.createElement('span');
      b.className = 'esp-edit';
      b.innerHTML = ICON_EDIT;
      b.title = '선택한 노드 수정';
      b.setAttribute('role', 'button');
      b.setAttribute('data-where', bars[i][0]);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditor();
      });
      bar.appendChild(b);
    }
    // 🔍 버튼은 트리 쪽 막대에만
    var main = bars[0][1];
    if (main && !main.querySelector('.esp-find')) {
      var f = document.createElement('span');
      f.className = 'esp-find';
      f.title = 'Elements 검색';
      f.setAttribute('role', 'button');
      f.innerHTML = ICON_FIND;
      f.addEventListener('click', function (e) {
        e.stopPropagation();
        if (q('#' + SEARCH_ID)) closeSearch(); else openSearch();
      });
      main.appendChild(f);
    }
  }

  function hasEditButtons() {
    return {
      main: !!q('#eruda-elements .eruda-elements > .eruda-control .esp-edit'),
      detail: !!q('#eruda-elements .eruda-detail > .eruda-control .esp-edit'),
      find: !!q('#eruda-elements .eruda-elements > .eruda-control .esp-find')
    };
  }

  // Eruda가 지금 선택해 둔 노드 (Eruda 내부 값 — 같은 실행 환경일 때만 보임)
  function getCurNode() {
    var er = getEruda();
    if (!er) return { err: '이 실행 환경에서는 Eruda 내부에 접근할 수 없음 (LOAD_ERUDA=true로 쓰면 해결)' };
    var els;
    try { els = er.get('elements'); } catch (e) { return { err: 'Elements 도구를 못 찾음' }; }
    var n = els && els._curNode;
    if (!n) return { err: '선택된 노드가 없음 — 트리에서 노드를 먼저 누르세요' };
    if (!n.isConnected && n.ownerDocument && !n.ownerDocument.contains(n)) return { err: '선택된 노드가 이미 페이지에서 사라짐' };
    return { node: n, els: els };
  }

  function nodeLabel(n) {
    if (!n) return '-';
    if (n.nodeType === 1) {
      var s = '<' + n.localName;
      if (n.id) s += '#' + n.id;
      if (typeof n.className === 'string' && n.className.trim()) s += '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.');
      return s + '>';
    }
    if (n.nodeType === 3) return '텍스트 "' + n.nodeValue.trim().slice(0, 20) + (n.nodeValue.trim().length > 20 ? '…' : '') + '"';
    if (n.nodeType === 8) return '주석';
    return n.nodeName;
  }

  // 이 노드를 통째로 바꾸면 Eruda나 페이지 뼈대가 날아가는 경우 → 여는 태그(속성)만 수정
  function isAttrOnly(n) {
    var host = getHost();
    return n === document.documentElement || n === document.head || n === document.body ||
      (host && n.contains && n.contains(host));
  }

  function startTag(el) {
    var s = '<' + el.localName;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      s += ' ' + a.name + '="' + a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    }
    return s + '>';
  }

  // 원래 자리와 같은 문맥(부모 태그·SVG 여부)에서 HTML을 해석. 스크립트는 실행되지 않음.
  function parseLike(old, html) {
    var p = old.parentNode;
    var ctx;
    if (p && p.nodeType === 1) {
      var ns = p.namespaceURI;
      var name = p.localName;
      // 사용자 정의 요소는 만들 때 생성자가 돌 수 있어서 div로 대신
      if (ns === 'http://www.w3.org/1999/xhtml' && (name.indexOf('-') >= 0 || name === 'template')) name = 'div';
      ctx = document.createElementNS(ns, name);
    } else {
      ctx = document.createElement('div');
    }
    ctx.innerHTML = html;
    return ctx;
  }

  function attrsOf(el) {
    var out = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      out.push([a.namespaceURI, a.name, a.value]);
    }
    return out;
  }

  function setAttrs(el, list) {
    var keep = {};
    for (var i = 0; i < list.length; i++) keep[list[i][1]] = true;
    for (var j = el.attributes.length - 1; j >= 0; j--) {
      var a = el.attributes[j];
      if (!keep[a.name]) el.removeAttributeNode(a);
    }
    for (var k = 0; k < list.length; k++) {
      var it = list[k];
      if (el.getAttribute(it[1]) === it[2]) continue;
      if (it[0]) el.setAttributeNS(it[0], it[1], it[2]); else el.setAttribute(it[1], it[2]);
    }
  }

  function pushUndo(u) {
    undoStack.push(u);
    if (undoStack.length > 20) undoStack.shift();
  }

  // 수정 적용. 결과 { node, msg } 또는 { err }
  // beforeRemove(node): 노드를 페이지에서 빼기 직전에 호출 (Eruda 버그 회피용, moveSelectionOff 참고)
  function applyEdit(node, mode, text, beforeRemove) {
    if (mode === 'text') {
      var before = node.nodeValue;
      if (before === text) return { node: node, msg: '바뀐 내용 없음' };
      node.nodeValue = text;
      pushUndo({ kind: 'text', node: node, before: before });
      return { node: node, msg: '텍스트 수정됨' };
    }

    if (mode === 'attrs') {
      var m = /^\s*<\s*([^\s>\/]+)([\s\S]*?)\/?\s*>\s*$/.exec(text);
      if (!m) return { err: '여는 태그 하나만 적어 주세요. 예) <body class="a">' };
      if (m[1].toLowerCase() !== node.localName.toLowerCase()) return { err: '이 요소는 태그 이름을 바꿀 수 없음 (' + node.localName + ')' };
      var tpl = document.createElement('template');
      tpl.innerHTML = '<div' + m[2] + '></div>';
      var probe = tpl.content.firstElementChild;
      if (!probe) return { err: '속성을 해석하지 못함' };
      var prevA = attrsOf(node);
      setAttrs(node, attrsOf(probe));
      pushUndo({ kind: 'sync', el: node, attrs: prevA, children: null });
      return { node: node, msg: '속성 수정됨' };
    }

    // mode === 'html' : 요소 통째(outerHTML) 수정
    var src = text.replace(/^\s+|\s+$/g, '');
    if (!src) return { err: '내용이 비어 있음 — 노드를 지우려면 트리 위쪽의 ✕(삭제) 버튼을 쓰세요' };
    if (src === node.outerHTML) return { node: node, msg: '바뀐 내용 없음' };
    var ctx = parseLike(node, src);
    var parsed = [];
    for (var i = 0; i < ctx.childNodes.length; i++) parsed.push(ctx.childNodes[i]);
    if (!parsed.length) return { err: '해석 결과가 비어 있음 (이 자리에 올 수 없는 태그일 수 있음)' };

    var one = parsed.length === 1 && parsed[0].nodeType === 1 ? parsed[0] : null;
    if (one && one.namespaceURI === node.namespaceURI && one.localName === node.localName && node.localName !== 'template') {
      // 같은 태그면 요소는 그대로 두고 속성·내용만 바꿈 → 이 요소에 걸린 이벤트가 유지됨
      var undo = { kind: 'sync', el: node, attrs: attrsOf(node), children: null };
      setAttrs(node, attrsOf(one));
      if (node.innerHTML !== one.innerHTML) {
        undo.children = [];
        while (node.firstChild) undo.children.push(node.removeChild(node.firstChild));
        while (one.firstChild) node.appendChild(one.firstChild);
      }
      pushUndo(undo);
      return { node: node, msg: undo.children ? '속성·내용 수정됨 (안쪽 요소는 새로 만들어짐)' : '속성 수정됨' };
    }
    // 태그가 바뀌었거나 여러 개가 됨 → 통째로 교체
    var parent = node.parentNode;
    if (!parent) return { err: '부모가 없는 노드라 교체할 수 없음' };
    if (beforeRemove) beforeRemove(node);
    for (var j = 0; j < parsed.length; j++) parent.insertBefore(parsed[j], node);
    parent.removeChild(node);
    pushUndo({ kind: 'replace', old: node, added: parsed });
    var firstEl = null;
    for (var k = 0; k < parsed.length; k++) if (parsed[k].nodeType === 1) { firstEl = parsed[k]; break; }
    return { node: firstEl || parsed[0], msg: '요소를 새로 교체함 (' + parsed.length + '개 노드)' };
  }

  function undoLast(beforeRemove) {
    var u = undoStack.pop();
    if (!u) return { err: '되돌릴 수정이 없음' };
    try {
      if (u.kind === 'text') { u.node.nodeValue = u.before; return { node: u.node, msg: '되돌림 (텍스트)' }; }
      if (u.kind === 'sync') {
        setAttrs(u.el, u.attrs);
        if (u.children) {
          if (beforeRemove && u.el.firstChild) beforeRemove(u.el.firstChild); // 안쪽 노드가 선택돼 있어도 안전하게
          while (u.el.firstChild) u.el.removeChild(u.el.firstChild);
          for (var i = 0; i < u.children.length; i++) u.el.appendChild(u.children[i]);
        }
        return { node: u.el, msg: '되돌림 (원래 요소 그대로 복원)' };
      }
      if (u.kind === 'replace') {
        var anchor = null;
        for (var j = 0; j < u.added.length; j++) if (u.added[j].parentNode) { anchor = u.added[j]; break; }
        if (!anchor) return { err: '교체한 노드가 이미 페이지에 없어서 되돌릴 수 없음' };
        if (beforeRemove) beforeRemove(anchor);
        anchor.parentNode.insertBefore(u.old, anchor);
        for (var k = 0; k < u.added.length; k++) if (u.added[k].parentNode) u.added[k].parentNode.removeChild(u.added[k]);
        return { node: u.old, msg: '되돌림 (원래 요소 그대로 복원)' };
      }
    } catch (e) {
      return { err: '되돌리기 실패: ' + (e && e.message ? e.message : e) };
    }
    return { err: '알 수 없는 되돌리기 항목' };
  }

  function reselect(els, node) {
    try { if (els && node && node.nodeType === 1 && node.isConnected !== false && typeof els.select === 'function') els.select(node); } catch (e) {}
  }

  // Eruda 3.4.3 버그: 지금 선택된 노드가 페이지에서 빠지면 내부에서 없는 함수(e.set)를 불러 오류가 남.
  // → 빼기 전에 선택을 부모로 옮겨 둠. 새 노드 선택은 Eruda가 트리를 다시 그린 뒤(setTimeout)에 함.
  function moveSelectionOff(els) {
    return function (n) {
      var p = n && n.parentNode;
      while (p && p.nodeType !== 1) p = p.parentNode || p.host;
      if (p) reselect(els, p);
    };
  }

  function copyText(ta, text, done) {
    function fallback() {
      try {
        ta.focus();
        ta.setSelectionRange(0, ta.value.length); // iOS는 select()만으론 부족
        var ok = document.execCommand('copy');
        done(ok ? '복사됨' : '복사 실패 — 글자를 길게 눌러 직접 복사하세요');
      } catch (e) { done('복사 실패 — 글자를 길게 눌러 직접 복사하세요'); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done('복사됨'); }, fallback);
        return;
      }
    } catch (e) {}
    fallback();
  }

  function themeColors() {
    function pick(sel, prop, fb) {
      var e = q(sel);
      var v = e ? getComputedStyle(e)[prop] : '';
      return (!v || v === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(v)) ? fb : v;
    }
    var ctl = '#eruda-elements .eruda-elements > .eruda-control';
    return {
      '--esp-bg': pick('#eruda-elements .eruda-detail', 'backgroundColor', '#fff'),
      '--esp-fg': pick('#eruda-elements .eruda-detail', 'color', '#333'),
      '--esp-dark': pick(ctl, 'backgroundColor', '#f3f3f3'),
      '--esp-border': pick(ctl, 'borderBottomColor', '#ccc'),
      '--esp-primary': pick(ctl, 'color', '#333'),
      '--esp-accent': pick('.luna-tab-slider', 'backgroundColor', '#1a73e8'),
      '--esp-hi': pick('#eruda-elements .luna-dom-viewer-selection', 'backgroundColor', '#eaeaea'),
      // 수정 입력칸 글자 모양·크기를 Elements 트리와 똑같이
      '--esp-mono': pick('#eruda-elements .luna-dom-viewer', 'fontFamily', 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'),
      '--esp-ta-scale': String(Math.min(1, (parseFloat(pick('#eruda-elements .luna-dom-viewer', 'fontSize', '12px')) || 12) / 16))
    };
  }

  function closeEditor() {
    var ed = q('#' + EDITOR_ID);
    if (ed && ed.parentNode) ed.parentNode.removeChild(ed);
  }

  function openEditor() {
    closeEditor();
    var panel = q('#eruda-elements');
    if (!panel) return;
    var cur = getCurNode();

    var ed = document.createElement('div');
    ed.id = EDITOR_ID;
    var tc = themeColors();
    for (var k in tc) ed.style.setProperty(k, tc[k]);
    var head = document.createElement('div');
    head.className = 'esp-head';
    var ta = document.createElement('textarea');
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('spellcheck', 'false');
    var msg = document.createElement('div');
    msg.className = 'esp-msg';
    var bar = document.createElement('div');
    bar.className = 'esp-bar';

    function btn(label, cls, fn) {
      var b = document.createElement('span');
      b.className = 'esp-btn' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.setAttribute('role', 'button');
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      bar.appendChild(b);
      return b;
    }
    function say(t, isErr) {
      msg.textContent = t;
      msg.className = 'esp-msg' + (isErr ? ' esp-err' : '');
    }

    var node = cur.node, els = cur.els, mode = null;
    function load(n) {
      node = n;
      if (!n) { mode = null; ta.value = ''; ta.disabled = true; head.textContent = '수정할 노드 없음'; return; }
      ta.disabled = false;
      if (n.nodeType === 3 || n.nodeType === 8 || n.nodeType === 4) {
        mode = 'text'; ta.value = n.nodeValue;
        head.textContent = '✎ ' + nodeLabel(n) + ' — 글자 수정';
      } else if (n.nodeType === 1 && isAttrOnly(n)) {
        mode = 'attrs'; ta.value = startTag(n);
        head.textContent = '✎ ' + nodeLabel(n) + ' — 여는 태그(속성)만 수정 가능';
      } else if (n.nodeType === 1) {
        mode = 'html'; ta.value = n.outerHTML;
        head.textContent = '✎ ' + nodeLabel(n) + ' — HTML 수정';
      } else {
        mode = null; ta.value = ''; ta.disabled = true;
        head.textContent = '이 종류의 노드는 수정할 수 없음 (' + n.nodeName + ')';
      }
    }
    load(node);
    if (cur.err) say(cur.err, true);
    else if (mode === 'html') say('같은 태그면 요소는 유지하고 속성·내용만 바꿉니다. 태그를 바꾸면 통째로 교체됩니다.');
    else say('');

    var undoBtn;
    function refreshUndo() { undoBtn.className = 'esp-btn' + (undoStack.length ? '' : ' esp-off'); }
    function report(r, where) {
      if (r.err) { st.lastEdit = '❌ ' + where + ': ' + r.err; say(r.err, true); log(where + ' 실패:', r.err); return; }
      st.editCount++;
      st.lastEdit = '✅ ' + where + ': ' + r.msg + ' → ' + nodeLabel(r.node);
      var target = r.node;
      setTimeout(function () { reselect(els, target); }, 30);
      load(r.node);
      say(r.msg);
      refreshUndo();
    }

    btn('적용', 'esp-primary', function () {
      if (!node || !mode) { say(cur.err || '수정할 노드 없음', true); return; }
      var r;
      try { r = applyEdit(node, mode, ta.value, moveSelectionOff(els)); }
      catch (e) { r = { err: '적용 중 오류: ' + (e && e.message ? e.message : e) }; }
      report(r, '적용');
    });
    btn('복사', '', function () { copyText(ta, ta.value, function (t) { say(t, t.indexOf('실패') >= 0); }); });
    undoBtn = btn('되돌리기', '', function () { report(undoLast(moveSelectionOff(els)), '되돌리기'); });
    btn('닫기', '', closeEditor);
    refreshUndo();

    // 입력 중인 글자가 사이트 단축키(예: 동영상 사이트의 k, f)로 새지 않게 막음
    ['keydown', 'keyup', 'keypress'].forEach(function (t) {
      ta.addEventListener(t, function (e) {
        e.stopPropagation();
        if (t === 'keydown' && e.key === 'Escape') closeEditor();
        if (t === 'keydown' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); bar.firstChild.click(); }
      });
    });

    // 버튼은 위쪽에: 아이폰 키보드가 올라와도 가려지지 않고, Eruda 톱니 버튼과도 안 겹침
    ed.appendChild(head);
    ed.appendChild(bar);
    ed.appendChild(msg);
    var taWrap = document.createElement('div');
    taWrap.className = 'esp-ta-wrap';
    taWrap.appendChild(ta);
    ed.appendChild(taWrap);
    panel.appendChild(ed);
  }

  // ───── 3. 검색 ─────
  // Eruda 트리는 펼친 부분만 그려 두므로, 화면이 아니라 실제 페이지 DOM 전체를 뒤짐.
  // 찾는 대상: 태그·속성(예: class="btn"), 글자 내용, 주석, 그리고 CSS 선택자(예: #id, .cls, div > a)
  var srch = { q: '', list: [], idx: -1, capped: false, selector: false, last: '없음' };

  function openTagText(el) {
    var s = '<' + el.localName;
    for (var i = 0; i < el.attributes.length; i++) s += ' ' + el.attributes[i].name + '="' + el.attributes[i].value + '"';
    return s + '>';
  }

  function isErudaStyle(n) {
    return n.nodeType === 1 && n.localName === 'style' && n.parentNode === document.head &&
      /font-family:\s*eruda-icon|^\s*\.eruda-/.test(n.textContent || '');
  }

  // 한 요소가 아직 검색어에 맞는지 (수정 후 결과가 바뀌었는지 확인용)
  function stillMatches(el, query) {
    if (!el || !el.isConnected) return false;
    var ql = query.toLowerCase();
    try { if (el.matches(query)) return true; } catch (e) {}
    if (openTagText(el).toLowerCase().indexOf(ql) >= 0) return true;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if ((c.nodeType === 3 || c.nodeType === 8) && c.nodeValue && c.nodeValue.toLowerCase().indexOf(ql) >= 0) return true;
    }
    return false;
  }

  // Eruda는 노드를 선택하면 트리 줄로 포커스를 옮김 → 아이폰에선 검색 키보드가 닫혀 버림.
  // 검색으로 이동할 때만 그 순간 포커스 이동을 막음 (동기 실행 동안만, 바로 원래대로 복구)
  function selectKeepFocus(els, el) {
    var P = window.HTMLElement && HTMLElement.prototype;
    var orig = P && P.focus;
    try {
      if (P) P.focus = function () {};
      reselect(els, el);
    } finally {
      if (P) P.focus = orig;
    }
  }

  function findMatches(query) {
    var host = getHost();
    var ql = query.toLowerCase();
    var bySel = null;
    try { bySel = document.querySelectorAll(query); } catch (e) {} // 선택자가 아니면 그냥 글자로만 찾음
    var selSet = null;
    if (bySel && bySel.length) { selSet = new Set(); for (var s = 0; s < bySel.length; s++) selSet.add(bySel[s]); }

    var root = document.documentElement;
    var out = [], seen = new Set(), capped = false;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT, {
      acceptNode: function (n) {
        if (n === host) return NodeFilter.FILTER_REJECT; // Eruda 자체는 제외
        if (n.nodeType === 1 && n.classList && n.classList.contains('__chobitsu-hide__')) return NodeFilter.FILTER_REJECT;
        if (isErudaStyle(n)) return NodeFilter.FILTER_REJECT; // Eruda가 <head>에 넣는 아이콘 글꼴·강조 스타일
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (var n = root; n; n = walker.nextNode()) {
      var hit = null;
      if (n.nodeType === 1) {
        if ((selSet && selSet.has(n)) || openTagText(n).toLowerCase().indexOf(ql) >= 0) hit = n;
      } else if (n.nodeValue && n.nodeValue.toLowerCase().indexOf(ql) >= 0) {
        hit = n.parentElement; // 글자가 맞으면 그 글자를 담은 요소로 이동
      }
      if (hit && !seen.has(hit)) {
        seen.add(hit);
        out.push(hit);
        if (out.length >= SEARCH_MAX) { capped = true; break; }
      }
    }
    // 글자 일치는 부모 요소로 바뀌어 순서가 섞일 수 있어서 문서 순서로 정렬
    out.sort(function (a, b) {
      return a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    });
    return { list: out, capped: capped, selector: !!selSet };
  }

  // 선택된 줄이 보이도록 트리 스크롤 (페이지 자체는 안 움직이게 직접 계산)
  function scrollToSelected() {
    var item = q('#eruda-elements .luna-dom-viewer-selected');
    var box = q('#eruda-elements .eruda-dom-viewer-container');
    if (!item || !box) return;
    var ir = item.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (ir.top < br.top + 8 || ir.bottom > br.bottom - 8) {
      box.scrollTop += (ir.top - br.top) - (br.height / 2) + (ir.height / 2);
    }
    if (ir.left < br.left || ir.left > br.right - 40) box.scrollLeft += ir.left - br.left - 20;
  }

  function closeSearch() {
    var bar = q('#' + SEARCH_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    var wrap = q('#eruda-elements .eruda-elements');
    if (wrap) wrap.classList.remove('esp-searching');
    var f = q('#eruda-elements .esp-find');
    if (f) f.classList.remove('esp-on');
  }

  function openSearch() {
    var wrap = q('#eruda-elements .eruda-elements');
    if (!wrap) return;
    closeSearch();
    var er = getEruda();
    var els = null;
    try { els = er && er.get('elements'); } catch (e) {}

    var bar = document.createElement('div');
    bar.id = SEARCH_ID;
    var tc = themeColors();
    for (var k in tc) bar.style.setProperty(k, tc[k]);
    var f = q('#eruda-elements .esp-find');
    if (f) { f.style.setProperty('--esp-accent', tc['--esp-accent']); f.classList.add('esp-on'); }

    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = '글자·속성·선택자 검색';
    input.setAttribute('enterkeyhint', 'search');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.value = srch.q;
    var count = document.createElement('span');
    count.className = 'esp-count';

    function sbtn(label, title, fn, keepFocus) {
      var b = document.createElement('span');
      b.className = 'esp-sbtn';
      b.textContent = label;
      b.title = title;
      b.setAttribute('role', 'button');
      if (keepFocus) {
        // ▲▼를 눌러도 입력칸 포커스가 안 빠지게 → 아이폰 키보드가 내려갔다 올라오지 않음
        // (touchend를 막으면 뒤따르는 click이 안 생기므로 여기서 바로 실행)
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('touchend', function (e) { if (e.cancelable) { e.preventDefault(); e.stopPropagation(); fn(); } });
      }
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      bar.appendChild(b);
      return b;
    }

    function showCount() { // 검색 결과 수(예: 2/5) 표시
      var n = srch.list.length;
      if (!els) { count.textContent = '사용 불가'; count.className = 'esp-count esp-none'; }
      else if (!srch.q) { count.textContent = ''; count.className = 'esp-count'; }
      else if (!n) { count.textContent = '0건'; count.className = 'esp-count esp-none'; }
      else { count.textContent = (srch.idx + 1) + '/' + n + (srch.capped ? '+' : ''); count.className = 'esp-count'; }
      prev.className = next.className = 'esp-sbtn' + (n > 1 ? '' : ' esp-off');
    }

    function run(noJump) {
      srch.q = input.value.trim();
      srch.idx = -1;
      if (!srch.q || !els) { srch.list = []; showCount(); return; }
      var t0 = Date.now(), r;
      try { r = findMatches(srch.q); } catch (e) { r = { list: [], capped: false, selector: false }; log('검색 오류', e); }
      srch.list = r.list; srch.capped = r.capped; srch.selector = r.selector;
      srch.last = '"' + srch.q + '" → ' + r.list.length + (r.capped ? '+' : '') + '건' + (r.selector ? ' (선택자 포함)' : '') + ', ' + (Date.now() - t0) + 'ms';
      if (srch.list.length && !noJump) go(1); else showCount();
    }

    function go(delta) {
      if (!els) { showCount(); return; }
      if (!srch.list.length) { if (input.value.trim()) run(); return; }
      // 수정·삭제로 결과가 바뀌었으면 다시 검색하고, 지금 위치 바로 다음(이전) 결과부터 이어감
      for (var v = 0; v < srch.list.length; v++) {
        if (stillMatches(srch.list[v], srch.q)) continue;
        var from = srch.list[srch.idx], keep = srch.idx;
        run(true);
        var L = srch.list;
        if (!L.length) return;
        var pos = -1, i;
        if (from && from.isConnected) {
          if (delta > 0) {
            for (i = 0; i < L.length; i++) if (L[i] !== from && (from.compareDocumentPosition(L[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) { pos = i; break; }
            if (pos < 0) pos = 0;
          } else {
            for (i = L.length - 1; i >= 0; i--) if (L[i] !== from && (from.compareDocumentPosition(L[i]) & Node.DOCUMENT_POSITION_PRECEDING)) { pos = i; break; }
            if (pos < 0) pos = L.length - 1;
          }
        } else { // 지금 결과가 지워졌으면: ▼는 그 자리를 채운 다음 결과, ▲는 바로 앞 결과
          pos = delta > 0 ? Math.min(Math.max(keep, 0), L.length - 1) : (Math.max(keep, 0) - 1 + L.length) % L.length;
        }
        srch.idx = pos - delta; // 아래에서 delta만큼 움직이면 pos에 도착
        break;
      }
      var n = srch.list.length;
      srch.idx = ((srch.idx + delta) % n + n) % n;
      var el = srch.list[srch.idx];
      selectKeepFocus(els, el);
      showCount();
      setTimeout(scrollToSelected, 30);
    }

    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(run, 300); // 글자 칠 때마다 바로 뒤지지 않고 잠깐 멈추면 검색
    });
    ['keydown', 'keyup', 'keypress'].forEach(function (t) {
      input.addEventListener(t, function (e) {
        e.stopPropagation(); // 사이트 단축키로 새지 않게
        if (t !== 'keydown') return;
        if (e.key === 'Enter') {
          e.preventDefault();
          if (srch.q !== input.value.trim()) { clearTimeout(timer); run(); }
          else go(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
          closeSearch();
        }
      });
    });

    bar.appendChild(input);
    bar.appendChild(count);
    var prev = sbtn('▲', '이전', function () { go(-1); }, true);
    var next = sbtn('▼', '다음', function () { go(1); }, true);
    sbtn('✕', '검색 닫기', closeSearch);

    wrap.appendChild(bar);
    wrap.classList.add('esp-searching');
    showCount();
    if (!els) count.title = '이 실행 환경에서는 Eruda 내부에 접근할 수 없음 (LOAD_ERUDA=true로 쓰면 해결)';
    try { input.focus(); } catch (e) {}
    if (srch.q && els) run(); // 다시 열면 이전 검색어로 바로 검색
  }

  // ───── 4. 톱니 버튼 길게 눌러 숨기기 ─────
  var gear = { hidden: false, bound: null, pressing: false, lastTouchEnd: 0, toggles: 0, peeks: 0, clickBlock: '-' };
  var peekTimer = null;

  function setGearHidden(h) {
    gear.hidden = !!h;
    clearTimeout(peekTimer);
    var btn = q('.eruda-entry-btn');
    if (btn) {
      btn.classList.toggle('esp-gear-hidden', gear.hidden);
      btn.classList.remove('esp-gear-peek');
    }
  }

  // 숨긴 톱니: 화면을 건드리면(탭·스크롤 등) 잠깐 보였다가 저절로 다시 사라짐
  // → 숨긴 위치를 잊어도 되고, 아무것도 안 건드리는 스크린샷 순간에는 안 보임
  function peekGear(e) {
    if (!gear.hidden || gear.pressing) return; // 톱니를 누르고 있는 동안(길게 눌러 숨기는 중 등)은 손 떨림으로 다시 보이지 않게
    if (e && e.isTrusted === false) return; // 사이트 스크립트가 만든 가짜 이벤트는 무시
    if (e && e.type === 'mousedown' && Date.now() - gear.lastTouchEnd < 1000) return; // 손가락을 뗀 직후 브라우저가 덧붙이는 마우스 이벤트(같은 터치)
    var btn = gear.bound;
    if (!btn || !btn.isConnected) return;
    if (!btn.classList.contains('esp-gear-peek')) { btn.classList.add('esp-gear-peek'); gear.peeks++; }
    clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { btn.classList.remove('esp-gear-peek'); }, PEEK_MS);
  }
  // 사람이 직접 건드린 것만 셈 (손가락·마우스·휠·키보드). 'scroll' 이벤트는 쓰지 않음 —
  // 사이트가 저절로 넘기는 슬라이드 등에서도 생겨서, 아무것도 안 건드려도 톱니가 보이게 되기 때문
  // capture: 페이지가 이벤트를 막아도 먼저 받음 / passive: 스크롤을 늦추지 않음
  ['touchstart', 'touchmove', 'pointerdown', 'mousedown', 'wheel', 'keydown'].forEach(function (t) {
    window.addEventListener(t, peekGear, { capture: true, passive: true });
  });
  ['touchend', 'touchcancel', 'mouseup'].forEach(function (t) {
    window.addEventListener(t, function () {
      gear.pressing = false;
      if (t !== 'mouseup') gear.lastTouchEnd = Date.now();
    }, { capture: true, passive: true });
  });

  function toggleGear() {
    setGearHidden(!gear.hidden);
    gear.toggles++;
    log('톱니 버튼 ' + (gear.hidden ? '숨김' : '보임'));
    return gear.hidden;
  }

  function bindGear() {
    var btn = q('.eruda-entry-btn');
    if (!btn || btn === gear.bound) return;
    // 다른 쪽(북마클릿·다른 실행 환경의 이 스크립트)이 이미 맡았으면 겹쳐 달지 않음 → 길게 누르기가 두 번 처리되지 않게
    if (btn.getAttribute('data-esp-gear')) return;
    btn.setAttribute('data-esp-gear', VERSION);
    gear.bound = btn;
    if (gear.hidden) btn.classList.add('esp-gear-hidden'); // Eruda를 껐다 켜도 숨김 유지

    // 길게 누르기 진행 테두리 (톱니와 같은 둥근 네모, 둘레를 100으로 잡아 채움)
    var SVGNS = 'http://www.w3.org/2000/svg';
    var ring = document.createElementNS(SVGNS, 'svg');
    ring.setAttribute('class', 'esp-ring');
    ring.setAttribute('viewBox', '0 0 50 50');
    var edge = document.createElementNS(SVGNS, 'rect');
    edge.setAttribute('x', '2'); edge.setAttribute('y', '2');
    edge.setAttribute('width', '46'); edge.setAttribute('height', '46');
    edge.setAttribute('rx', '13'); edge.setAttribute('pathLength', '100');
    ring.appendChild(edge);
    btn.appendChild(ring);
    btn.style.setProperty('--esp-ring-delay', RING_DELAY_MS + 'ms');
    btn.style.setProperty('--esp-ring-dur', (LONG_PRESS_MS - RING_DELAY_MS) + 'ms');
    btn.style.setProperty('--esp-accent', themeColors()['--esp-accent']);

    var timer = null, sx = 0, sy = 0, popTimer = null;
    function ringOff() { btn.classList.remove('esp-holding', 'esp-hold-done'); }
    function pop() {
      clearTimeout(popTimer);
      btn.classList.remove('esp-hold-pop');
      void btn.offsetWidth; // 효과를 처음부터 다시 재생
      btn.classList.add('esp-hold-pop');
      popTimer = setTimeout(function () { btn.classList.remove('esp-hold-pop'); }, 300);
    }
    function pt(e) {
      var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      return [t.clientX, t.clientY];
    }
    function stop() {
      clearTimeout(timer);
      timer = null;
      ringOff(); // 손을 떼거나 끌기 시작하면 테두리 지움
      document.removeEventListener('touchmove', move, true);
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('touchend', stop, true);
      document.removeEventListener('touchcancel', stop, true);
      document.removeEventListener('mouseup', stop, true);
    }
    function move(e) {
      var p = pt(e);
      if (Math.abs(p[0] - sx) > 8 || Math.abs(p[1] - sy) > 8) stop(); // 끌어서 옮기는 중이면 취소
    }
    function start(e) {
      if (e.type === 'mousedown' && (e.button !== 0 || timer)) return;
      gear.pressing = true; // 숨긴 톱니라면 누르는 순간(touchstart)에는 이미 잠깐 보이기가 처리된 뒤
      stop();
      var p = pt(e);
      sx = p[0]; sy = p[1];
      document.addEventListener('touchmove', move, true);
      document.addEventListener('mousemove', move, true);
      document.addEventListener('touchend', stop, true);
      document.addEventListener('touchcancel', stop, true);
      document.addEventListener('mouseup', stop, true);
      void btn.offsetWidth; // 테두리 채우기를 처음부터 다시 재생
      btn.classList.add('esp-holding');
      timer = setTimeout(function () {
        timer = null;
        btn.classList.remove('esp-holding');
        btn.classList.add('esp-hold-done'); // 다 찬 테두리는 손을 뗄 때까지 유지 → "이제 떼도 됨"
        toggleGear();
        pop();
        // 손을 뗄 때 Eruda가 '탭'으로 알아듣고 창을 열고 닫지 않게
        var er = getEruda();
        try {
          if (er && er._entryBtn) { er._entryBtn._isClick = false; gear.clickBlock = '가능'; }
          else gear.clickBlock = '불가 (다른 실행 환경 — 길게 누르면 창도 같이 열리고 닫힘)';
        } catch (x) { gear.clickBlock = '불가'; }
      }, LONG_PRESS_MS);
    }
    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('mousedown', start);
  }

  // ───── 6. 아이콘 글꼴 살리기 ─────
  // Eruda 아이콘(톱니·휴지통·화살표 등)은 data: 주소로 넣은 글꼴로 그림. GitHub처럼 보안 정책(CSP)이
  // 글꼴 주소를 제한하는 사이트에선 이 글꼴이 막혀 아이콘이 네모로 보임.
  // → 막힌 글꼴만, 같은 글꼴 데이터를 브라우저에 직접 넘겨 등록(FontFace) — 주소로 불러오는 게 아니라 CSP에 안 걸림
  var fonts = { host: null, checked: {}, blocked: 0, fixed: 0, failed: 0 };
  var FONT_RE = /@font-face\s*\{[^}]*?font-family:\s*['"]?([\w-]+)['"]?[^}]*?url\(\s*['"]?data:[^,]*?;base64,([A-Za-z0-9+\/=]+)/g;

  function addFontData(family, b64, wasBlocked) {
    try {
      var bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var face = new FontFace(family, bytes.buffer);
      face.load().then(function () { document.fonts.add(face); if (wasBlocked) fonts.fixed++; }, function () { fonts.failed++; });
    } catch (e) { fonts.failed++; }
  }

  function checkFont(family, b64) {
    if (fonts.checked[family] || !/^(eruda|luna)-/.test(family)) return; // Eruda 글꼴만, 한 번씩
    fonts.checked[family] = true;
    document.fonts.load('16px "' + family + '"').then(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].status === 'loaded') return; // 정상
      addFontData(family, b64, false); // 페이지 쪽에 등록이 안 된 글꼴(Shadow DOM 안에만 선언된 것) — 똑같은 글꼴을 등록만 함
    }, function () {
      fonts.blocked++; // 보안 정책(CSP)에 막힘
      addFontData(family, b64, true);
    });
  }

  function fixIconFonts() {
    var host = getHost();
    if (!host || host === fonts.host || !document.fonts || typeof FontFace === 'undefined' || typeof atob === 'undefined') return;
    fonts.host = host;
    var styles = [].slice.call(document.querySelectorAll('style'));
    if (host.shadowRoot) styles = styles.concat([].slice.call(host.shadowRoot.querySelectorAll('style')));
    for (var i = 0; i < styles.length; i++) {
      var t = styles[i].textContent || '', m;
      if (t.indexOf('@font-face') < 0) continue;
      FONT_RE.lastIndex = 0;
      while ((m = FONT_RE.exec(t))) checkFont(m[1], m[2]);
    }
  }

  // ───── 7. Console 탭 All/Info/Warning/Error 음영 고치기 ─────
  // Eruda 3.4.3 버그: 버튼을 누르면 거르기는 되는데, 내부에서 고른 단계를 목록(['error'])으로 넘기고
  // 음영 처리는 글자('error')로 비교해서 늘 All에만 음영이 남음 → 누른 버튼으로 음영을 옮김
  function fixConsoleLevels() {
    var bar = q('#eruda-console .eruda-control');
    if (!bar || bar.getAttribute('data-esp-level')) return; // 막대마다 한 번만 (다른 실행 환경의 이 스크립트와도 겹치지 않게)
    bar.setAttribute('data-esp-level', VERSION);
    bar.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.eruda-level') : null;
      if (!btn || !bar.contains(btn)) return;
      setTimeout(function () { // Eruda가 음영을 (잘못) 바꾼 다음에 바로잡음
        var all = bar.querySelectorAll('.eruda-level');
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('eruda-active', all[i] === btn);
      }, 0);
    });
  }

  // ───── 감시: Eruda가 나중에 뜨거나 다시 켜질 때 / Elements가 늦게 그려질 때 ─────
  var lastHost = null, innerObs = null;
  function watchInner() {
    var host = getHost();
    if (!host || host === lastHost || typeof MutationObserver === 'undefined') return;
    lastHost = host;
    if (innerObs) innerObs.disconnect();
    var root = host.shadowRoot || host;
    innerObs = new MutationObserver(function () {
      var hb = hasEditButtons();
      if (!q('#' + STYLE_ID) || !hb.main || !hb.find) applyPatch();
    });
    innerObs.observe(root, { childList: true, subtree: true });
  }

  function watchHost() {
    if (st.observing || typeof MutationObserver === 'undefined') return;
    var target = document.documentElement;
    if (!target) return;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].id === 'eruda') {
            // Eruda를 껐다 켜면 Info·Snippets 탭도 새로 만들어지므로 진단·메뉴도 다시 등록
            setTimeout(function () { applyPatch(); watchInner(); registerDiag(getEruda()); }, 0);
            return;
          }
        }
      }
    }).observe(target, { childList: true }); // 직계 자식만 감시(가벼움). #eruda는 <html> 바로 아래에 붙음
    st.observing = true;
  }

  // ───── 진단 ─────
  function probe(el) {
    if (!el) return null;
    var c = getComputedStyle(el);
    return {
      sel: c.webkitUserSelect || c.userSelect || '',
      callout: c.webkitTouchCallout || '(미지원)'
    };
  }

  function fmt(p) {
    if (!p) return '요소 없음 (Elements 탭을 한 번 열고 다시 확인)';
    return 'user-select=' + p.sel + ', touch-callout=' + p.callout;
  }

  function diagnose() {
    var host = getHost();
    var sr = host && host.shadowRoot;
    var er = getEruda();
    var gi = null;
    try { if (typeof GM_info !== 'undefined') gi = GM_info; } catch (e) {}

    var styleOk = !!(host && q('#' + STYLE_ID));
    var tree = probe(q('#eruda-elements .luna-dom-viewer-tree-item'));
    var attr = probe(q('#eruda-elements .eruda-attributes'));
    var styles = probe(q('#eruda-elements .eruda-styles'));
    var btns = host ? hasEditButtons() : { main: false, detail: false, find: false };
    var cur = host ? getCurNode() : { err: '-' };
    var canEdit = !!er;

    var selOk = styleOk && tree && tree.sel === 'text';
    var ok = selOk && btns.main && btns.find && canEdit;
    var verdict;
    if (!host) verdict = '❌ Eruda 화면이 없음 — ' + (st.initError || '아직 안 뜸');
    else if (!styleOk) verdict = '❌ 패치 스타일이 안 들어감';
    else if (!tree) verdict = '⚠️ Elements 탭이 아직 그려지지 않음 — 탭을 연 뒤 다시 확인';
    else if (!selOk) verdict = '❌ 스타일은 들어갔지만 선택 불가로 계산됨';
    else if (!btns.main || !btns.find) verdict = '⚠️ 선택은 정상, ✎/🔍 버튼이 안 붙음';
    else if (!canEdit) verdict = '⚠️ 선택은 정상, 수정·검색은 불가 — Eruda가 다른 실행 환경에서 뜸';
    else verdict = '✅ 정상 — 선택·복사·수정·검색 가능';

    return {
      ok: ok,
      lines: [
        ['판정', verdict],
        ['패치 버전', VERSION],
        ['스크립트 관리자', gi ? ((gi.scriptHandler || '?') + ' ' + (gi.version || '')) : 'GM_info 없음'],
        ['Eruda', er ? ('v' + (er.version || '?')) : '이 실행 환경에선 안 보임'],
        ['Eruda를 띄운 쪽', st.source],
        ['초기화 오류', st.initError || '없음'],
        ['Shadow DOM', host ? (sr ? '사용' : '미사용') : '-'],
        ['패치 스타일', styleOk ? ('있음 (삽입 ' + st.applyCount + '회)') : '없음'],
        ['DOM 트리', fmt(tree)],
        ['속성 패널', fmt(attr)],
        ['스타일 패널', fmt(styles)],
        ['✎ 버튼', '트리 ' + (btns.main ? '있음' : '없음') + ' / 상세 ' + (btns.detail ? '있음' : '없음')],
        ['🔍 버튼', btns.find ? '있음' : '없음'],
        ['마지막 검색', srch.last],
        ['톱니 버튼', (gear.hidden ? '숨김' : '보임') + ' (길게 눌러 전환 ' + gear.toggles + '회, 건드려서 잠깐 보임 ' + gear.peeks + '회, 연결 ' + (gear.bound && gear.bound.isConnected ? '됨' : (q('.eruda-entry-btn[data-esp-gear]') ? '다른 쪽 스크립트가 담당' : '안 됨')) + ', 탭 막기 ' + gear.clickBlock + ')'],
        ['선택된 노드', cur.node ? nodeLabel(cur.node) : cur.err],
        ['수정 횟수', st.editCount + '회 (되돌리기 ' + undoStack.length + '개 대기)'],
        ['마지막 수정', st.lastEdit],
        ['호스트 감시', st.observing ? '켜짐' : '꺼짐'],
        ['아이콘 글꼴', fonts.blocked ? ('보안 정책(CSP)에 막힘 ' + fonts.blocked + '개 → 직접 넣어 살림 (성공 ' + fonts.fixed + ', 실패 ' + fonts.failed + ')')
          : (fonts.failed ? '실패 ' + fonts.failed + '개' : '정상')],
        ['UA', navigator.userAgent]
      ]
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function diagText() {
    return diagnose().lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
  }

  function registerDiag(er) {
    // 콘솔에서 직접 부를 수 있게
    try {
      window.__erudaSelectPatch = {
        version: VERSION, diagnose: diagnose, text: diagText, reapply: applyPatch,
        edit: openEditor, undo: undoLast, _apply: applyEdit,
        search: openSearch, _find: findMatches, toggleGear: toggleGear
      };
    } catch (e) {}
    if (!er) return;
    // Info·Snippets 탭마다 한 번만 등록 (Eruda를 껐다 켜면 탭이 새로 만들어지므로 그때는 다시 등록)
    var info = null, snip = null;
    try { info = er.get('info'); snip = er.get('snippets'); } catch (e) {}
    // Eruda > Info 탭에 진단 항목 추가 (Info 탭을 열 때마다 새로 계산)
    if (info && !info.__espDiag) try {
      info.__espDiag = VERSION;
      info.add('선택·수정·검색 패치 진단', function () {
        return diagnose().lines.map(function (l) {
          return '<b>' + esc(l[0]) + '</b>: ' + esc(l[1]);
        }).join('<br>');
      });
    } catch (e) { log('Info 탭 등록 실패', e); }
    // Eruda > Snippets 탭에 '다시 적용 + 진단' 버튼 추가 — 찾기 쉽게 맨 위로
    if (snip && !snip.__espSnip) try {
      snip.__espSnip = VERSION;
      var SNIP_NAME = '선택·수정·검색 패치: 다시 적용 + 진단';
      snip.add(SNIP_NAME, function () {
        applyPatch();
        log('\n' + diagText());
      }, '패치를 다시 넣고 진단 결과를 Console 탭에 출력');
      // Eruda의 add()는 항상 맨 아래에 붙임 → 내부 목록에서 맨 앞으로 옮기고 다시 그림 (내부 구조가 바뀌면 그냥 맨 아래에 둠)
      var list = snip._snippets;
      if (Array.isArray(list) && typeof snip._render === 'function') {
        for (var i = list.length - 1; i > 0; i--) {
          if (list[i].name === SNIP_NAME) { list.unshift(list.splice(i, 1)[0]); snip._render(); break; }
        }
      }
    } catch (e) { log('Snippets 등록 실패', e); }
  }

  // ───── 5. 북마클릿으로 켜고 끄기 ─────
  // 북마클릿은 DOM 이벤트로 신호만 보냄 → 실행 환경이 달라도(wBlock 격리 환경 등) 이 스크립트가 직접 켜고 끔
  var IS_BM = typeof __ESP_BOOKMARKLET__ !== 'undefined'; // 북마클릿 버전은 감싸는 코드에서 정의함

  function turnOn() {
    if (getHost()) return;
    var e = getEruda();
    if (!e) return; // 이 스크립트가 Eruda를 못 받은 경우(AMD 사이트 등) → 북마클릿이 받아 온 뒤 다시 신호를 보냄
    try { e.init({ useShadowDom: USE_SHADOW_DOM }); }
    catch (x) { st.initError = 'eruda.init() 오류: ' + (x && x.message ? x.message : x); return; }
    if (st.initError && st.initError.indexOf('해결됨') < 0) st.initError += ' → 북마클릿으로 해결됨';
    st.source = IS_BM ? '북마클릿' : '북마클릿 신호로 이 유저스크립트가 띄움';
    setGearHidden(false); // 켤 때는 톱니가 보이게
    applyPatch();
    watchInner();
    registerDiag(e);
    log('Eruda 켬 (북마클릿)');
  }

  function turnOff() {
    var e = getEruda();
    if (!e || !getHost()) return;
    try { e.destroy(); } catch (x) { log('Eruda 끄기 실패', x); return; }
    if (innerObs) innerObs.disconnect();
    innerObs = null; lastHost = null; gear.bound = null;
    st.source = '꺼짐 (북마클릿)';
    log('Eruda 끔 (북마클릿)');
  }

  document.addEventListener('esp-eruda-on', turnOn);
  document.addEventListener('esp-eruda-off', turnOff);

  // ───── 실행 ─────
  var er = getEruda();
  if (getHost()) {
    st.source = '이미 페이지에 있음 (다른 방법으로 로드됨)';
  } else if (LOAD_ERUDA) {
    if (!er) {
      var amd = false;
      try { amd = typeof define === 'function' && !!define.amd; } catch (e) {}
      st.source = '로드 실패';
      st.initError = amd
        ? '이 사이트가 AMD(define)를 써서 Eruda가 전역에 안 잡힘'
        : '@require로 Eruda를 못 받음 (네트워크·차단 앱 확인)';
    } else {
      try {
        er.init({ useShadowDom: USE_SHADOW_DOM });
        st.source = IS_BM ? '북마클릿' : '이 유저스크립트 (@require)';
      } catch (e) {
        st.initError = 'eruda.init() 오류: ' + (e && e.message ? e.message : e);
      }
    }
  } else {
    st.source = '대기 중 (LOAD_ERUDA=false — 다른 방법으로 띄우면 자동 적용)';
  }

  applyPatch();
  watchHost();
  watchInner();
  registerDiag(getHost() ? er : null);

  var d = diagnose();
  log(diagText().split('\n').slice(0, 8).join(' | '));
})();
