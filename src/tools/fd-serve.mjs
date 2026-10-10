/* Flow-Desk 本地服务器 —— 这一份只是老门牌，真身在 src\_fd\fd-serve.mjs。
   两处各写一个服务器就是两份会各自漂移的代码：这一份还把目录钉死在 pages\ 上，第 15 条分树之后就指不到了。
   只留一份实现，这个文件转发过去，start-fd.bat 那个老入口照常能用。
   用法、端口、环境变量都看那一份：node fd-serve.mjs，浏览器开 http://127.0.0.1:8791/ */
import '../_fd/fd-serve.mjs';
