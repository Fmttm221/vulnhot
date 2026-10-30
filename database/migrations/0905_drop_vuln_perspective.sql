-- 红蓝视角模块（modules/vuln-perspective）已下线：页面、队列、定时任务与读取接口一并删除，这里删掉它留下的表。
-- 表里是模型生成的文字，可以从别处重新生成；没有其他表引用它。
DROP TABLE IF EXISTS vuln_perspective;
