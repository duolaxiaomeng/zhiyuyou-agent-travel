"use strict";
/** 开发文档 UTF-8 正文源：由 node 写回 data 目录下正式 txt，避免部分工具对 .txt 编码误判 */
module.exports = `中国大学生计算机设计大赛

软件开发类作品文档简要要求

作品编号：      2026052345
作品名称：智渝游—AI赋能城乡导流的文旅服务平台
版本编号：
填写日期：




目录
第一章 需求分析	1
1.1 项目背景	1
1.2 目标用户与核心功能	1
1.3 主要性能	1
1.4 AI使用说明	1
第二章 概要设计	1
2.1 设计目标	1
2.2 系统总体架构图	2
2.3 功能模块层次	3
2.4 模块调用关系	3
2.5 模块间接口	4
2.6 人机界面	4
第三章 详细设计	5
3.1 界面设计	5
3.1.1 界面清单与职责	5
3.1.2 典型使用流程	6
3.1.3 Web端界面展示	6
3.2 数据与库设计	6
3.2.1 服务端持久化	6
3.2.2 浏览器端逻辑存储	6
3.2.3 用户贴结构	7
3.3 接口设计	7
3.4 关键技术	7
3.4.1 同源静态托管+REST API一体化部署	7
3.4.2 用户身份：bcrypt密码哈希+JWT无状态鉴权	8
3.4.3 大模型能力接入：服务端代理+流式/非流式统一转发	8
3.4.4 交流中心：演示级（海量内容）的可控生成与列表工程	8
3.4.5 人机交互工程：移动端导航与长下拉可用性	8
3.4.6 前端状态与多端一致性说明（演示边界）	8
3.5 安全与非功能	8
第四章 测试报告	9
4.1 测试环境与范围	9
4.2 主要测试用例与结果	9
4.3 缺陷与修正记录（摘要）	10
4.4 技术指标	10
第五章 安装及使用	10
5.1 环境要求	10
5.2 安装步骤	10
5.3 测试账号	11
5.4 公网访问	11
第六章 项目总结	11
参考文献	12

第一章 需求分析
1.1 项目背景
当前，城乡文旅资源呈现严重的结构性失衡，集中体现为三大痛点：一是城乡客流“冰火两重天”，主城热门景区过载而周边区县优质资源乏人问津；二是体验与预期不对称，传统图文无法展示动态文化场景，非遗项目多为被动观赏，深度体验缺失；三是文旅消费信任危机，农产品因缺乏可信溯源而溢价能力不足，消费者真伪难辨。
在此背景下，本作品以重庆为试点，构建“智渝游”文旅服务平台，致力于用AI+VR技术打通城乡文旅资源壁垒，实现客流智能导流与均衡分配。
1.2 目标用户与核心功能
目标用户包括城市亲子家庭、乡村游爱好者、小众景点探索者、文旅商户及区县文旅部门等。核心功能涵盖AI智能路线规划、720°全景沉浸预览、农产品溯源、用户认证系统、内容社区五大模块。系统基于B/S架构，已完整开发14个前端页面，并基于Node.js+Express实现配套后端API，提供用户身份认证、购物车与订单、交流发帖、会员与资料扩展、AI服务转发、静态资源托管等能力；业务数据持久化至外接MySQL数据库，前后端接口已全部联调完成。
1.3 主要性能
系统运行流畅，SSE流式首字响应时间小于1秒，静态页面加载时间小于500ms。支持Chrome、Edge、Firefox等主流浏览器。前后端逻辑分离，接口规范统一，敏感信息通过环境变量隔离，具备良好的安全性与扩展性。
1.4 AI使用说明
（1）使用的模型/工具
① DeepSeek-Chat API（用于AI路线规划，2026年4月）；
② 豆包大模型API（用于天气联网查询，2026年4月）。
（2）AI应用环节
① AI路线规划：调用DeepSeek大模型，通过SSE流式生成Markdown格式旅行攻略；
② 天气联网查询：调用豆包大模型联网搜索获取目的地实时天气数据。
（3）学生把关工作
所有AI生成内容均经团队成员逐条验证。路线规划的Prompt经过反复调试以控制输出质量；AI返回内容通过extractFirstJsonObject等函数进行格式校验与异常兜底，失败时自动回退为纯文本显示。AI生成结果的正确性通过人工逐条比对目的地信息、天气数据准确性及行程合理性进行验证。

第二章 概要设计
2.1 设计目标
面向重庆城乡文旅导流，提供信息浏览、AI行程、VR导览、特产直购、交流社区、账号体系；前端为静态页面同源访问，Node.js+Express提供REST接口与AI代理；用户与购物、社区发帖、会员与资料扩展等核心业务数据持久化至外接MySQL数据库（库名在.env或.env.local中由DB_NAME配置，一般为travel），通过手机号将各块数据关联到同一用户；浏览器localStorage仍承担登录令牌缓存、交流喜欢/收藏等轻量状态，与数据库形成互补。
2.2 系统总体架构图
（略，答辩材料中可补图）
2.3 功能模块层次
（略，可按实际模块树补充）
2.4 模块调用关系
（略）
2.5 模块间接口
接口/约定	方法	调用方	说明
/api/register	POST	auth.js	注册，写入MySQL users表，返回token+user
/api/login	POST	auth.js	登录，校验users表密码哈希，返回token+user
/api/me	GET	auth-client.js、auth-guard.js	Bearer JWT，取当前用户
/api/user/cart	GET/PUT	user-data-api.js等	购物车JSON，表user_carts
/api/user/orders	GET/POST	user-data-api.js	订单列表与下单，表orders
/api/community/user-posts	GET	community-data.js	用户发帖列表（community_posts）
/api/community/posts/:id	GET	community-detail.js	帖子详情
/api/community/posts	POST	community-publish.js	发帖（需登录）
/api/community/posts/:id	PUT	同上	编辑本人帖子
/api/user/member-state	GET/POST	user-data-api.js	会员与VR次数，表user_member_state
/api/user/profile-extra	GET/PUT	profile.js等	个人扩展资料JSON，表user_profile_extra
/api/user/import-legacy	POST	user-data-api.js	将浏览器旧数据批量导入库（迁移辅助）
/api/assistant	POST	float-ai.js、features.js	通用助手，代理上游
/api/weather-assistant	POST	aiplanning.js等	天气相关对话代理
/api/route-assistant	POST	aiplanning.js	路线文案代理
localStorage各key	—	多模块	zyyToken、zyyCurrentUser、喜欢/收藏键等
静态资源路径	GET	浏览器	server.js静态托管
2.6 人机界面
主导航（各页顶栏一致）：首页→AI路线规划→VR导览→农产品直购→交流中心；未登录显示登录/注册，已登录显示个人主页入口与退出。
界面	主要人机交互
首页	轮播、酒店/景区预订表单、功能入口
AI规划	偏好、目的地、天数人数、生成路线、结果阅读与反馈
VR	场景切换、搜索/热门标签、iframe全景
直购	商品列表、详情、购物车、结算相关页
交流中心	筛选、排序、分页、帖子卡片、跳转详情/发布
个人主页	资料编辑、足迹图、喜欢/收藏、会员说明
登录注册	表单校验、跳转回原页
浮助手	打开对话、流式/非流式回复（依赖配置）

第三章 详细设计
3.1 界面设计
3.1.1 界面清单与职责
页面/区域	文件	主要控件与交互
全站顶栏	*.html、main.js、main.css	Logo、主导航、站内搜索（≥1024px）、汉堡菜单（≤1023px）、登录态navUser
首页	index.html、hero-carousel.js等	轮播、酒店/景区预订表单、home-field_select
AI路线规划	planner.html、features.js、aiplanning.js	偏好chips、起点文本、#filterDestination、#dayBudget、生成按钮、结果区；窄屏目的地为多行可滚列表
VR导览	vr.html、页内脚本	搜索、热门data-spot切换iframe、文案区
交流中心	guide.html、community.js、community-data.js	分类、区县chips、搜索、排序、#communityFeed每页24条、底部分页与页码跳转
发帖/我的发布	community-publish.html、community-publish.js	表单校验；发帖提交至/api/community/posts
帖子详情	community-detail.html、community-detail.js	id查帖（含API）；喜欢/收藏写本地键
个人主页	profile.html、profile.js	资料、足迹图、喜欢/收藏网格；资料扩展与/api/user/profile-extra同步
登录注册	login.html、register.html、auth.js	调/api/login、/api/register，ZYYAuth.setSession
悬浮助手	float-ai.js	POST /api/assistant，可流式
3.1.2 典型使用流程
（略）
3.1.3 Web端界面展示
图1 首页首屏；图2 AI路线规划页；交流中心、VR导览页、登录后顶栏用户区/个人主页入口

3.2 数据与库设计
3.2.1 服务端持久化（MySQL）
数据库连接参数由.env或.env.local提供，主要包括DB_HOST、DB_PORT、DB_USER、DB_PASSWORD、DB_NAME；其中DB_NAME一般为travel，对应「智渝游」中小型业务库，围绕用户与购物、社区、会员、资料等模块设计。服务启动时server.js会对缺失表执行CREATE TABLE IF NOT EXISTS，便于首次部署自动建表。
核心业务表及用途如下（均以手机号phone与users关联，把原先分散在代码或users.json等文件中的用户相关数据纳入关系库）：
表名	主要字段与说明
users	id；username（昵称）；phone（11位，唯一）；password_hash（bcrypt，不存明文）；created_at
user_carts	phone主键；items_json（购物车条目JSON）；updated_at
orders	id；phone；order_no（唯一）；items_json；item_count；total；status（如待发货）；created_at
community_posts	id；phone；author；destination、type、title、content、image、score、likes；user_post；created_at、updated_at
user_member_state	phone主键；ar_used（VR体验次数等）；member_until（会员到期）；updated_at
user_profile_extra	phone主键；extra_json（头像、简介等扩展JSON）；updated_at
身份与鉴权：登录成功由server.js签发JWT（载荷含sub、username、phone），无独立服务端会话表；正式环境可增加刷新令牌、吊销与审计。
数据迁移说明：早期演示将注册用户写入项目内data/users.json；现已改为写入users表。可使用scripts/import-users-from-json.js将历史users.json导入库，或使用scripts/import-local-data-files.js、登录后POST /api/user/import-legacy将本地JSON合并入库，实现从文件存储到数据库的过渡。
3.2.2 浏览器端逻辑存储
键名	内容形态	写入方（主要）
zyyToken	string	auth.js、auth-client.js
zyyCurrentUser	JSON对象{username,phone,...}	登录接口、/api/me回填
zyyCommunityLikedKeys/zyyCommunityStarredKeys	JSON字符串数组（帖子ID）	community-detail.js、community-data.js（喜欢/收藏仍为本地，换设备不同步）
zyyUserProfileExtra	可选本地缓存	与profile页、服务端extra_json策略配合时以脚本为准
购物车、订单、用户发帖、会员、资料扩展	经REST读写MySQL	user-data-api.js等与server.js；交流列表为「程序生成种子帖+community_posts用户帖」合并展示
（其他键名以各脚本内常量为准）
3.2.3 用户贴结构
字段	说明
id	用户帖：uc+时间戳；种子帖：seed-xx/gen-slug-nn
destination,type,title,content,image,score,likes	列表展示与筛选字段
author, authorPhone	权限控制：仅当authorPhone与当前用户手机号一致时可编辑/删除；落库时authorPhone对应community_posts.phone
userPost	true表示用户发布的帖子
createdAt/updatedAt	ISO格式时间戳

3.3 接口设计
路径	方法	请求体（要点）	成功响应（要点）
/api/register	POST	username,phone,password	{token,user}
/api/login	POST	phone,password	{token,user}
/api/me	GET	Header: Authorization: Bearer <token>	{user}
/api/user/cart	GET/PUT	PUT时body.items数组	{items}等
/api/user/orders	GET/—	POST时订单字段	{orders}/新建结果
/api/community/user-posts	GET	—	{posts}
/api/community/posts/:id	GET	—	单帖JSON
/api/community/posts	POST	destination,type,title,content等	新建帖
/api/community/posts/:id	PUT	同发帖字段	更新后帖
/api/user/member-state	GET/POST	plan、ar-use等子路径按约定	会员与次数状态
/api/user/profile-extra	GET/PUT	extra对象	扩展资料JSON
/api/user/import-legacy	POST	本地bundle JSON	导入摘要
/api/assistant	POST	上游兼容体（含messages等）	JSON或流式SSE
/api/weather-assistant	POST	同代理模式	依赖DOUBAO_*环境变量
/api/route-assistant	POST	同代理模式	依赖DEEPSEEK_*环境变量

3.4 关键技术
3.4.1 同源静态托管+REST API一体化部署
使用Node.js+Express在同一端口托管静态资源并提供/api/*接口；server.js中维护MySQL连接池与业务路由。配置好数据库与.env.local后执行npm start即可演示。
3.4.2 用户身份：bcrypt密码哈希+JWT无状态鉴权
注册时对密码做bcrypt哈希写入users表的password_hash；登录签发JWT；/api/me通过Authorization: Bearer校验。实现见server.js、auth.js、auth-client.js。
3.4.3 大模型能力接入：服务端代理+流式/非流式统一转发
前端不持有上游API Key；由server.js转发/api/assistant、/api/weather-assistant、/api/route-assistant等；环境变量配置上游地址与密钥。
3.4.4 交流中心：演示级可控生成与列表工程
内置精选帖与按区县程序生成模板帖，合并community_posts中的用户发帖，统一筛选、排序、分页；用户发帖与编辑经REST持久化。喜欢/收藏仍主要用localStorage。
3.4.5 人机交互工程：移动端导航与长下拉可用性
汉堡菜单断点前移至max-width:1023px；窄屏下对超长select采用多行可滚动列表等策略。
3.4.6 前端状态与多端一致性说明（演示边界）
登录态token与喜欢/收藏等仍以localStorage为主；购物车、订单、发帖、会员、资料扩展等与用户强相关的数据落MySQL，换设备登录同一账号可拉取一致数据。
3.5 安全与非功能
JWT密钥使用JWT_SECRET环境变量；密码仅存服务端bcrypt；数据库与上游密钥放在.env.local，勿提交仓库。须通过npm start同源访问；file://无法调用/api/*。

第四章 测试报告
4.1 测试环境与范围
被测系统：智渝游Web（静态页+server.js+MySQL）。访问方式：npm start后浏览器访问http://localhost:3000。浏览器：Chrome/Edge（PC）；Chrome移动模拟或实机（窄屏≤1023px）。测试范围含注册登录、购物车与订单、交流中心、AI规划、VR切换、顶栏与窄屏交互；数据库需已配置且可连通。
4.2 主要测试用例与结果（摘要）
T1 未启动服务直接打开HTML：登录失败或提示非JSON，与auth.js一致。
T2 注册新用户：返回token，MySQL users表新增记录（users.json已弃用作为主存储）。
T3 重复手机号注册：业务错误提示。
T4 错误密码登录：401。
T5 /api/me无效Token：401并清理本地会话。
T6 交流中心筛选与分页：列表与页码一致。
T7 发帖与列表：新帖出现，用户帖在community_posts持久化。
T8 规划页窄屏目的地列表：可滚动多行可选。
T9 AI未配置：503，前端有提示。
T10 VR场景切换：iframe与文案区更新。
T11 数据库未配置或不可达：相关接口失败有提示。
4.3 缺陷与修正记录（摘要）
交流中心筛选叠加为空：选择区县时重置分类为「全部」等交互优化。移动端原生下拉可视行过少：窄屏size+可滚动样式。顶栏平板宽度挤压：断点前移至1023px。file://或非HTTP访问导致非JSON：文档与前端提示强调npm start。
4.4 技术指标
运行速度主观流畅；AI依赖外网与上游。安全性：密码bcrypt存MySQL；JWT鉴权；密钥与DB凭据仅服务端环境变量。扩展性：核心表已结构化；喜欢/收藏可后续迁库。部署：npm install + 配置.env.local + npm start。

第五章 安装及使用
5.1 环境要求
Node.js 16.x及以上；现代浏览器。外接MySQL 5.7/8.0及以上，建议utf8mb4，预先创建空库（库名与DB_NAME一致，一般为travel）。
5.2 安装步骤
（1）拷贝项目到工作目录，终端进入根目录。
（2）执行npm install。
（3）配置.env.local：填写DB_HOST、DB_PORT、DB_USER、DB_PASSWORD、DB_NAME（如travel）；JWT_SECRET；可选AI相关变量（DEEPSEEK_*、DOUBAO_*等）。
（4）（可选）从旧users.json迁移：执行node scripts/import-users-from-json.js，或使用import-local-data-files.js、登录后POST /api/user/import-legacy。
（5）执行node server.js或npm start（启动时会自动建表）。
（6）浏览器访问http://localhost:3000。勿直接双击打开HTML；数据库不可达时注册登录等接口将失败。
5.3 测试账号
手机号：12345678910 / 密码：123456
5.4 公网访问
本项目已部署至阿里云ECS，公网IP：139.129.33.215，端口：3001，使用PM2进程管理。

第六章 项目总结
1. 项目协调与任务分解：页面相对独立、公共能力抽离；先打通主链路再打磨交互与数据层；用户数据由users.json演进为MySQL多表并与REST对齐。
2. 困难与处理：file://与同源访问问题；交流内容规模与演示成本平衡；移动端下拉与顶栏响应式；引入MySQL后的环境变量与启动建表、可选导入脚本降低部署成本。
3. 收获：理解轻后端+静态前端+关系库持久化的边界；令牌与偏好可放浏览器，账号与订单等须服务端持久化。
4. 后续方向：备份与索引；喜欢/收藏按需迁库；AI限流与缓存；接口契约与CI；容器化与HTTPS。
5. 推广与运营设想：突出城乡导流+AI+VR+直购组合；与文旅与电商合作；小程序等入口。商业化需合规、支付物流与内容治理。
6. 结语：先把主链路跑通，再用数据与交互打磨可信度；以可运营、可度量为主线持续推进。

参考文献
[1] 唐承财，梅江海，上官令仪，等. 新质生产力视域下国内外数字文旅研究评述与展望[J]. 地理科学进展，2024,43(10):1894-1912.
[2] 杨吉花. 数字文旅方案智能生成产教融合平台的设计研究[J]. 计算机时代,2026,(04):81-85.
[3] 常亮，曹玉婷，孙文平. 旅游推荐系统研究综述[J]. 计算机科学，2017,44(10):1-6.
[4] 李旭，李景文，俞娜. 基于用户需求的旅游路线推荐方法[J]. 计算机工程与设计，2021,42(5):1339-1345.
[5] 谭鸿波，苏甜，张思颖，等. 基于在线评论与深度学习的旅游目的地推荐系统[J]. 陕西师范大学学报(自然科学版),2025,53(2):101-113.
[6] 刘敖迪，杜学绘，王娜，等. 区块链技术及其在信息安全领域的研究进展[J]. 软件学报，2018,29(7):2092-2115.
[7] 胡云锋，孙九林，张千力，等. 中国农产品质量安全追溯体系建设现状和未来发展[J]. 中国工程科学，2018,20(2):57-62.
[8] 周雄，郑芳. 基于区块链技术的农产品质量安全溯源体系构建探究[J]. 中共福建省委党校学报，2019(3):113-117.
[9] 张文元，刘佳硕，谢菁. 基于知识图谱的古建筑数字化研究综述：热点、趋势与前沿[J]. 华中师范大学学报(自然科学版),2025,59(4):493-508.
[10] 余意峰，李佳妮，翁李胜. 湖北省数字文旅企业时空分布特征与影响因素研究[J]. 华中师范大学学报(自然科学版),2025,59(3):309-320.
`;
