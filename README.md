# egern
个人使用

egern的组件

倒计时.js
https://raw.githubusercontent.com/hikling/egern/refs/heads/main/component/daojishi.js

网络监测.js
https://raw.githubusercontent.com/hikling/egern/refs/heads/main/component/wangluotop.js

万年历.js
https://raw.githubusercontent.com/hikling/egern/refs/heads/main/component/huanglitop.js

汇率.js
https://raw.githubusercontent.com/hikling/egern/refs/heads/main/component/huilvtop.js

## PingMe 多账户签到

模块地址： https://raw.githubusercontent.com/hikling/egern/refs/heads/main/component/pingme.yaml

默认每天 00:00、06:00、12:00、18:00 运行。模块设置提供「参数抓取」和「随机设备 ID」开关；随机设备 ID 只用于视频奖励，签到使用抓取时的设备 ID。

首次使用时，在 Egern 的模块设置中本地填写「签名参数」（使用原版 PingMe 脚本中的 `SECRET` 值，勿提交到公开仓库）。登录一个账号后打开余额页，等 Egern 通知确认抓取成功。

**多账号注意：不要在 PingMe App 内点击「退出登录」来切换账号。**原版多账户脚本作者建议：确认账号可重新登录、需要的本地数据已备份后，卸载并重新安装 **PingMe App**，再登录下一个账号抓取；不要卸载 Egern。App 内退出可能让前一个账号的会话失效。

若某账号提示「设备已退出登录」，按上述方式重新登录并打开余额页抓取。运行前确认抓取通知仍显示预期的账号总数；脚本会在唯一无邮箱账号失效时，用新抓包替换旧记录。
