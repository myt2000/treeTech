# 中文翻译术语表（ZH Glossary）

This glossary fixes the Chinese translations used across the i18n dictionary
(`i18n-zh.js`) and the batch technology translations (`data/i18n/zh.json`).
Keep all translation batches consistent with it. Data keys (ids, era/field/branch
enum values, `region`, source titles) are never translated.

## 核心原则

- 技术 `id`、时代/分支/领域枚举键、`region`、来源文献标题：一律保留英文。
- 译名以中文技术界通用叫法为准；无通行译名的缩写（CRISPR、EUV、RAG、MLOps）保留原文。
- 描述句式：一句完整中文，以句号结尾，不逐词直译。

## 固定译名

| 英文 | 中文 |
| --- | --- |
| prerequisite | 前置技术 |
| unlock / unlocks | 解锁（技术） |
| dependency edge | 依赖边 |
| evidence / source | 证据 / 来源 |
| source-checked | 已核来源 |
| review status | 审核状态 |
| maturity | 成熟度 |
| roadmap | 路线图 |
| era | 时代 |
| field | 领域 |
| branch | 分支 |
| lane | 子方向 |
| depth | 深度 |
| confidence | 置信度 |
| starter map | 起步地图 |
| printing press | 印刷机 |
| steam engine | 蒸汽机 |
| internet | 互联网 |
| CRISPR gene editing | CRISPR 基因编辑 |
| transistor | 晶体管 |
| photolithography | 光刻 |
| EUV lithography | 极紫外（EUV）光刻 |
| integrated circuit | 集成电路 |
| large language model | 大语言模型 |
| retrieval-augmented generation (RAG) | 检索增强生成（RAG） |
| electrical grid | 电网 |
| renewable energy | 可再生能源 |
| battery storage | 电池储能 |
| long-duration energy storage | 长时储能 |
| reusable launch vehicle | 可复用运载火箭 |
| water sanitation | 卫生设施/水处理（按语境） |
| vaccine | 疫苗 |
| antibiotic | 抗生素 |

## 年代格式

- 负数年份：`公元前 3000`（界面英文侧保持 `3,000 BCE`）。
- `firstKnownDate` 数值本身不改，只改显示。
