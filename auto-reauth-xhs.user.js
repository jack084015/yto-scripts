// ==UserScript==
// @name         自动重新授权 - WebSocket 触发2.3
// @namespace    https://erp.yto.net.cn/
// @version      2.3
// @description  监听 WebSocket 消息，收到指令后打开 ERP 页面并自动执行重新授权
// @match        https://erp.yto.net.cn/systemSetting/storeMag*
// @match        https://erp.yto.net.cn/*
// @match        https://customer.xiaohongshu.com/*
// @match        https://www.xiaohongshu.com/*
// @match        https://ark.xiaohongshu.com/*
// @updateURL    https://jack084015.github.io/yto-scripts/auto-reauth.user.js
// @downloadURL  https://jack084015.github.io/yto-scripts/auto-reauth.user.js
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // 配置项
  // ═══════════════════════════════════════════════════════════
  const WS_URL = 'ws://localhost:8080';                              // WebSocket 服务器地址
  const ERP_URL = 'https://erp.yto.net.cn/systemSetting/storeMag';   // ERP 目标页面
  const ORDER_URL = 'https://erp.yto.net.cn/order/orderOperate/listnew'; // 订单查询页面
  const TRIGGER_CMD = 'reauth';                                      // 重新授权指令
  const ORDER_CMD = 'order-query';                                   // 订单查询指令
  const TRIGGER_PARAM = 'vm-auto-run';                               // URL 标记参数
  const XHS_EMAIL = 'xxx';                           // 小红书邮箱
  const XHS_PASSWORD = 'xxx';                                 // 小红书密码

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═══════════════════════════════════════════════════════════
  const MAX_WAIT = 15000;
  const INTERVAL = 400;

  function waitFor(finder, label) {
    return new Promise((resolve, reject) => {
      const el = finder();
      if (el) { resolve(el); return; }

      const start = Date.now();
      const timer = setInterval(() => {
        const el = finder();
        if (el) {
          clearInterval(timer);
          resolve(el);
        } else if (Date.now() - start > MAX_WAIT) {
          clearInterval(timer);
          reject(new Error(`[油猴] 等待超时：${label}`));
        }
      }, INTERVAL);
    });
  }

  function clickAndDelay(el, delay = 600) {
    el.click();
    return new Promise(r => setTimeout(r, delay));
  }

  function findByText(selector, text) {
    return [...document.querySelectorAll(selector)]
      .find(el => el.innerText?.trim().includes(text)) || null;
  }

  function findByExactText(selector, text) {
    return [...document.querySelectorAll(selector)]
      .find(el => el.innerText?.trim() === text) || null;
  }

  function findDropdownOption(text) {
    const elOption = findByText('.el-select-dropdown__item, .el-tree-node__content, .el-option', text);
    if (elOption) return elOption;

    const antOption = findByText('.ant-select-item, .ant-dropdown-menu-item, .ant-select-dropdown .ant-select-item-option-content', text);
    if (antOption) return antOption;

    const generic = findByText('li, .option-item, [class*="option"], [class*="dropdown"] [class*="item"]', text);
    if (generic && generic.offsetParent !== null) return generic;

    return null;
  }

  function isErpPage() {
    return location.href.includes('erp.yto.net.cn/systemSetting/storeMag');
  }

  function isOrderPage() {
    return location.href.includes('erp.yto.net.cn/order/orderOperate/listnew');
  }

  // ═══════════════════════════════════════════════════════════
  // 授权流程（在 ERP 页面执行）
  // ═══════════════════════════════════════════════════════════
  async function run() {
    try {
      console.log('[油猴] 开始执行重新授权流程');

      // Step 1：点击【请选择店铺】
      console.log('[油猴] Step 1：等待【请选择店铺】...');
      const selector = await waitFor(() => {
        const input = document.querySelector('input[placeholder*="请选择店铺"]');
        if (input) return input;
        return findByText('.el-select, .ant-select, [class*="select"]', '请选择店铺') || null;
      }, '请选择店铺');

      console.log('[油猴] Step 1：点击【请选择店铺】');
      await clickAndDelay(selector, 1200);

      // Step 2：选择【小红书的店铺】
      console.log('[油猴] Step 2：等待下拉选项【小红书的店铺】...');
      const option = await waitFor(() => findDropdownOption('小红书的店铺'), '小红书的店铺');

      console.log('[油猴] Step 2：点击【小红书的店铺】');
      await clickAndDelay(option, 1200);

      // Step 3：点击【筛选】
      console.log('[油猴] Step 3：等待【筛选】按钮...');
      const filterBtn = await waitFor(() => {
        return (
          findByExactText('button, .el-button, .ant-btn, [role="button"]', '筛选') ||
          findByText('button, .el-button, .ant-btn', '筛选')
        );
      }, '筛选按钮');

      console.log('[油猴] Step 3：点击【筛选】');
      await clickAndDelay(filterBtn, 2000);

      // Step 4：点击【重新授权】
      console.log('[油猴] Step 4：等待【重新授权】按钮...');
      const reauthBtn = await waitFor(() => {
        return (
          findByExactText('button, .el-button, .ant-btn, [role="button"]', '重新授权') ||
          findByText('button, .el-button, .ant-btn, a', '重新授权')
        );
      }, '重新授权按钮');

      console.log('[油猴] Step 4：点击【重新授权】');
      reauthBtn.click();
      console.log('[油猴] Step 4：完成，等待小红书登录页面...');

    } catch (err) {
      console.error(err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 订单查询流程（在 ERP 订单页面执行）
  // ═══════════════════════════════════════════════════════════
  async function runOrderQuery() {
    try {
      console.log('[油猴] 开始执行订单查询流程');

      // 等待页面渲染完成
      console.log('[油猴] 等待页面渲染...');
      await new Promise(r => setTimeout(r, 3000));

      // Step 1：选择店铺
      console.log('[油猴] Step 1：等待店铺选择器...');
      const shopSelector = await waitFor(() => {
        const input = document.querySelector('input[placeholder*="请选择店铺"], input[placeholder*="店铺"]');
        if (input) return input;
        return findByText('.el-select, .ant-select, [class*="select"]', '请选择店铺') || null;
      }, '店铺选择器');

      console.log('[油猴] Step 1：点击店铺选择器');
      await clickAndDelay(shopSelector, 1200);

      // Step 2：选择【牙吃多了糖会痛的店】
      console.log('[油猴] Step 2：等待【牙吃多了糖会痛的店】...');
      const shopOption = await waitFor(() => {
        // XPath: //span[contains(text(),'牙吃多了糖会痛的店')]
        const xpath = "//span[contains(text(),'牙吃多了糖会痛的店')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (el && el.offsetParent !== null) return el;
        // fallback
        return findByText('span, .el-select-dropdown__item, .el-tree-node__content', '牙吃多了糖会痛的店') || null;
      }, '牙吃多了糖会痛的店');

      console.log('[油猴] Step 2：点击【牙吃多了糖会痛的店】');
      shopOption.click();
      shopOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 1200));

      // Step 3：点击筛选
      console.log('[油猴] Step 3：等待【筛选】按钮...');
      const filterBtn = await waitFor(() => {
        // XPath: //button[@type='button']//span[contains(text(),'筛选')]
        const xpath = "//button[@type='button']//span[contains(text(),'筛选')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (el && el.offsetParent !== null) return el;
        return null;
      }, '筛选按钮');

      console.log('[油猴] Step 3：点击【筛选】 ✓ 订单查询完成，即将关闭页面');
      filterBtn.click();
      filterBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    } catch (err) {
      console.error(err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 小红书登录流程（在小红书页面执行）
  // ═══════════════════════════════════════════════════════════
  function isXiaohongshuPage() {
    return location.href.includes('xiaohongshu.com');
  }

  async function runXhsLogin() {
    try {
      console.log('[油猴] 检测到小红书页面，开始执行登录流程');

      // 等待页面渲染完成
      console.log('[油猴] 等待页面渲染...');
      await new Promise(r => setTimeout(r, 3000));

      // Step 5：点击【账号登录】
      console.log('[油猴] Step 5：等待【账号登录】...');
      const accountLogin = await waitFor(() => {
        // XPath: (//div[contains(text(),'账号登录')])[1]
        const xpath = "//div[contains(text(),'账号登录')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (el && el.offsetParent !== null) return el;
        return null;
      }, '账号登录');

      console.log('[油猴] Step 5：点击【账号登录】');
      accountLogin.click();
      accountLogin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 2000));

      // Step 6：输入【邮箱】
      console.log('[油猴] Step 6：等待【邮箱输入框】...');
      const emailInput = await waitFor(() => {
        // XPath: //input[@placeholder='邮箱']
        return document.querySelector('input[placeholder="邮箱"]') || null;
      }, '邮箱输入框');

      console.log('[油猴] Step 6：输入【邮箱】');
      emailInput.focus();
      emailInput.value = XHS_EMAIL;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1000));

      // Step 7：输入【密码】
      console.log('[油猴] Step 7：等待【密码输入框】...');
      const pwdInput = await waitFor(() => {
        // XPath: //input[@placeholder='密码']
        return document.querySelector('input[placeholder="密码"]') || null;
      }, '密码输入框');

      console.log('[油猴] Step 7：输入【密码】');
      pwdInput.focus();
      pwdInput.value = XHS_PASSWORD;
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwdInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1000));

      // Step 8：点击【登录】
      console.log('[油猴] Step 8：等待【登录】按钮...');
      const loginBtn = await waitFor(() => {
        // XPath: (//span[@class='btn-content'])[1]
        return document.querySelector('span.btn-content') || null;
      }, '登录按钮');

      console.log('[油猴] Step 8：点击【登录】');
      loginBtn.click();
      loginBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 2000));

      // Step 9：点击【同意并登录】
      console.log('[油猴] Step 9：等待【同意并登录】...');
      const agreeBtn = await waitFor(() => {
        // XPath: //button/span[text()='同意并登录']
        const xpath = "//button/span[text()='同意并登录']";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (el && el.offsetParent !== null) return el;
        return null;
      }, '同意并登录');

      console.log('[油猴] Step 9：点击【同意并登录】 ✓ 登录完成，等待跳转授权页面...');
      agreeBtn.click();
      agreeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    } catch (err) {
      console.error(err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Ark 授权流程（在授权页面执行）
  // ═══════════════════════════════════════════════════════════
  function isArkAuthPage() {
    return location.href.includes('ark.xiaohongshu.com/ark/authorization');
  }

  async function runArkAuth() {
    try {
      console.log('[油猴] 检测到 Ark 授权页面，开始执行授权流程');

      // 等待页面渲染完成
      await new Promise(r => setTimeout(r, 2000));

      // Step 10：点击授权按钮
      console.log('[油猴] Step 10：等待授权按钮...');
      const authBtn = await waitFor(() => {
        // XPath: //div[@class='auth-btn']
        return document.querySelector('div.auth-btn') || null;
      }, '授权按钮');

      console.log('[油猴] Step 10：点击【授权按钮】 ✓ 全部完成，即将关闭页面');
      authBtn.click();
      authBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 1500));
      window.close();

    } catch (err) {
      console.error(err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WebSocket 监听（在非 ERP 页面执行）
  // ═══════════════════════════════════════════════════════════
  function startWebSocketListener() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log(`[油猴] WebSocket 已连接：${WS_URL}`);
    };

    ws.onmessage = (event) => {
      const cmd = event.data;
      console.log(`[油猴] 收到消息：${cmd}`);

      if (cmd === TRIGGER_CMD) {
        const url = `${ERP_URL}?${TRIGGER_PARAM}=1`;
        console.log(`[油猴] 正在打开 ERP 页面：${url}`);
        GM_openInTab(url, { active: false, insert: true }, false);
      } else if (cmd === ORDER_CMD) {
        const url = `${ORDER_URL}?${TRIGGER_PARAM}=1`;
        console.log(`[油猴] 正在打开订单查询页面：${url}`);
        GM_openInTab(url, { active: true, insert: true }, false);
      }
    };

    ws.onclose = () => {
      console.log('[油猴] WebSocket 断开，5秒后重连');
      setTimeout(startWebSocketListener, 5000);
    };

    ws.onerror = (err) => {
      console.error('[油猴] WebSocket 错误：', err);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 入口分发
  // ═══════════════════════════════════════════════════════════
  if (isArkAuthPage()) {
    // 在 Ark 授权页面：执行授权流程
    console.log('[油猴] 已进入 Ark 授权页面，开始执行授权流程');
    runArkAuth();
  } else if (isXiaohongshuPage()) {
    // 在小红书登录页面：执行登录流程
    console.log('[油猴] 已进入小红书页面，开始执行登录流程');
    runXhsLogin();
  } else if (isOrderPage()) {
    // 在订单查询页面：检查是否由 WebSocket 触发
    if (location.search.includes(`${TRIGGER_PARAM}=1`)) {
      console.log('[油猴] 由 WebSocket 触发进入订单查询页面，开始执行');
      history.replaceState(null, '', location.pathname + location.hash);
      runOrderQuery();
    } else {
      console.log('[油猴] 已进入订单查询页面，非 WebSocket 触发，不自动执行');
    }
  } else if (isErpPage()) {
    // 在 ERP 页面：检查是否由 WebSocket 触发
    if (location.search.includes(`${TRIGGER_PARAM}=1`)) {
      console.log('[油猴] 由 WebSocket 触发进入 ERP 页面，开始执行');
      // 可选：清理 URL 标记，避免刷新后重复执行
      history.replaceState(null, '', location.pathname + location.hash);
      run();
    } else {
      console.log('[油猴] 已进入 ERP 页面，非 WebSocket 触发，不自动执行');
    }
  } else {
    // 在监听页面：启动 WebSocket
    console.log(`[油猴] 当前非 ERP 页面，启动 WebSocket 监听：${WS_URL}`);
    startWebSocketListener();
  }
})();
