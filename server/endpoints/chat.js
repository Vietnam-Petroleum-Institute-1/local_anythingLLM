const { v4: uuidv4 } = require("uuid");
const { reqBody, userFromSession, multiUserMode } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { WorkspaceChats } = require("../models/workspaceChats");
const { SystemSettings } = require("../models/systemSettings");
const { Telemetry } = require("../models/telemetry");
const { streamChatWithWorkspace } = require("../utils/chats/stream");
const {
  ROLES,
  flexUserRoleValid,
} = require("../utils/middleware/multiUserProtected");
const { EventLogs } = require("../models/eventLogs");
const {
  validWorkspaceAndThreadSlug,
  validWorkspaceSlug,
} = require("../utils/middleware/validWorkspace");
const { writeResponseChunk } = require("../utils/helpers/chat/responses");
const { WorkspaceThread } = require("../models/workspaceThread");
const truncate = require("truncate");

// ==========================================
// Nhu Duc them vao
const http = require('http');
const { URL } = require('url');
// ==========================================

function chatEndpoints(app) {
  if (!app) return;

  app.post(
    "/workspace/:slug/stream-chat",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const { message, attachments = [] } = reqBody(request);
        const workspace = response.locals.workspace;

        if (!message?.length) {
          response.status(400).json({
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: !message?.length ? "Message is empty." : null,
          });
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();

        if (multiUserMode(response) && user.role !== ROLES.admin) {
          const limitMessagesSetting = await SystemSettings.get({
            label: "limit_user_messages",
          });
          const limitMessages = limitMessagesSetting?.value === "true";

          if (limitMessages) {
            const messageLimitSetting = await SystemSettings.get({
              label: "message_limit",
            });
            const systemLimit = Number(messageLimitSetting?.value);

            if (!!systemLimit) {
              const currentChatCount = await WorkspaceChats.count({
                user_id: user.id,
                createdAt: {
                  gte: new Date(new Date() - 24 * 60 * 60 * 1000),
                },
              });

              if (currentChatCount >= systemLimit) {
                writeResponseChunk(response, {
                  id: uuidv4(),
                  type: "abort",
                  textResponse: null,
                  sources: [],
                  close: true,
                  error: `You have met your maximum 24 hour chat quota of ${systemLimit} chats set by the instance administrators. Try again later.`,
                });
                return;
              }
            }
          }
        }

        await streamChatWithWorkspace(
          response,
          workspace,
          message,
          workspace?.chatMode,
          user,
          null,
          attachments
        );
        await Telemetry.sendTelemetry("sent_chat", {
          multiUserMode: multiUserMode(response),
          LLMSelection: process.env.LLM_PROVIDER || "openai",
          Embedder: process.env.EMBEDDING_ENGINE || "inherit",
          VectorDbSelection: process.env.VECTOR_DB || "lancedb",
          multiModal: Array.isArray(attachments) && attachments?.length !== 0,
          TTSSelection: process.env.TTS_PROVIDER || "native",
        });

        await EventLogs.logEvent(
          "sent_chat",
          {
            workspaceName: workspace?.name,
            chatModel: workspace?.chatModel || "System Default",
          },
          user?.id
        );
        response.end();
      } catch (e) {
        console.error(e);
        writeResponseChunk(response, {
          id: uuidv4(),
          type: "abort",
          textResponse: null,
          sources: [],
          close: true,
          error: e.message,
        });
        response.end();
      }
    }
  );

  app.post(
    "/workspace/:slug/thread/:threadSlug/stream-chat",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      validWorkspaceAndThreadSlug,
    ],
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const { message, attachments = [] } = reqBody(request);
        const workspace = response.locals.workspace;
        const thread = response.locals.thread;

        if (!message?.length) {
          response.status(400).json({
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error: !message?.length ? "Message is empty." : null,
          });
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();

        if (multiUserMode(response) && user.role !== ROLES.admin) {
          const limitMessagesSetting = await SystemSettings.get({
            label: "limit_user_messages",
          });
          const limitMessages = limitMessagesSetting?.value === "true";

          if (limitMessages) {
            const messageLimitSetting = await SystemSettings.get({
              label: "message_limit",
            });
            const systemLimit = Number(messageLimitSetting?.value);

            if (!!systemLimit) {
              // Chat qty includes all threads because any user can freely
              // create threads and would bypass this rule.
              const currentChatCount = await WorkspaceChats.count({
                user_id: user.id,
                createdAt: {
                  gte: new Date(new Date() - 24 * 60 * 60 * 1000),
                },
              });

              if (currentChatCount >= systemLimit) {
                writeResponseChunk(response, {
                  id: uuidv4(),
                  type: "abort",
                  textResponse: null,
                  sources: [],
                  close: true,
                  error: `You have met your maximum 24 hour chat quota of ${systemLimit} chats set by the instance administrators. Try again later.`,
                });
                return;
              }
            }
          }
        }

        await streamChatWithWorkspace(
          response,
          workspace,
          message,
          workspace?.chatMode,
          user,
          thread,
          attachments
        );

        // If thread was renamed emit event to frontend via special `action` response.
        await WorkspaceThread.autoRenameThread({
          thread,
          workspace,
          user,
          newName: truncate(message, 22),
          onRename: (thread) => {
            writeResponseChunk(response, {
              action: "rename_thread",
              thread: {
                slug: thread.slug,
                name: thread.name,
              },
            });
          },
        });

        await Telemetry.sendTelemetry("sent_chat", {
          multiUserMode: multiUserMode(response),
          LLMSelection: process.env.LLM_PROVIDER || "openai",
          Embedder: process.env.EMBEDDING_ENGINE || "inherit",
          VectorDbSelection: process.env.VECTOR_DB || "lancedb",
          multiModal: Array.isArray(attachments) && attachments?.length !== 0,
          TTSSelection: process.env.TTS_PROVIDER || "native",
        });

        await EventLogs.logEvent(
          "sent_chat",
          {
            workspaceName: workspace.name,
            thread: thread.name,
            chatModel: workspace?.chatModel || "System Default",
          },
          user?.id
        );
        response.end();
      } catch (e) {
        console.error(e);
        writeResponseChunk(response, {
          id: uuidv4(),
          type: "abort",
          textResponse: null,
          sources: [],
          close: true,
          error: e.message,
        });
        response.end();
      }
    }
  );


// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// Endpoint Nhu Duc them vao

  

// app.post('/chat', async (req, res) => {
//   const apiKey = 'app-D9Pu93saxHZi94qCkb33tQiA';
//   const url = 'http://103.75.180.47/v1/chat-messages';

//   // Lấy giá trị "query" từ query parameter
//   const userQuery = req.query.query;

//   // Kiểm tra nếu không có tham số "query" thì trả về lỗi
//   if (!userQuery) {
//     console.error('Missing "query" parameter in the query string.');
//     return res.status(400).json({ error: 'Missing "query" parameter in the query string.' });
//   }

//   console.log(`[stream-chat] userQuery: ${userQuery}`);

//   // Dữ liệu JSON bạn muốn gửi
//   const data = {
//     inputs: {
//       file_name: "abc.csv",
//       file_type: "csv",
//       chunk_id: "kjajakjdkjakakda"
//     },
//     query: userQuery,
//     response_mode: "streaming",
//     conversation_id: "",
//     user: "abc-123",
//     files: [
//       {
//         type: "image",
//         transfer_method: "remote_url",
//         url: "https://cloud.dify.ai/logo/logo-site.png"
//       }
//     ]
//   };

//   const postData = JSON.stringify(data);
//   console.log(`[stream-chat] Sending data: ${postData}`);

//   // Phân tích URL
//   const urlObj = new URL(url);
//   const options = {
//     hostname: urlObj.hostname,
//     port: urlObj.port || 80,
//     path: urlObj.pathname,
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${apiKey}`,
//       'Content-Type': 'application/json',
//       'Content-Length': Buffer.byteLength(postData)
//     }
//   };

//   try {
//     const finalResult = await new Promise((resolve, reject) => {
//       const reqPost = http.request(options, (response) => {
//         let result = '';
//         let buffer = '';

//         response.on('data', (chunk) => {
//           const chunkStr = chunk.toString('utf-8');
//           buffer += chunkStr;
//           console.log(`[stream-chat] Received chunk: ${chunkStr}`);

//           let lines = buffer.split('\n');
//           buffer = lines.pop(); // Giữ lại phần cuối chưa hoàn chỉnh

//           for (let line of lines) {
//             line = line.trim();
//             if (line.startsWith('data:')) {
//               const jsonString = line.replace(/^data:\s*/, '');
//               if (jsonString === '[DONE]') {
//                 console.log('[stream-chat] Stream finished.');
//                 reqPost.abort();
//                 resolve(result);
//                 return;
//               }
//               try {
//                 const jsonData = JSON.parse(jsonString);
//                 console.log('[stream-chat] Parsed JSON data:', jsonData);
//                 if (jsonData.answer) {
//                   result += jsonData.answer;
//                 } else {
//                   console.warn('[stream-chat] No "answer" found in JSON data.');
//                 }
//               } catch (err) {
//                 console.error('Error parsing JSON:', err);
//               }
//             }
//           }
//         });

//         response.on('end', () => {
//           // Xử lý phần còn lại trong buffer
//           if (buffer.startsWith('data:')) {
//             const jsonString = buffer.replace(/^data:\s*/, '');
//             if (jsonString !== '[DONE]') {
//               try {
//                 const jsonData = JSON.parse(jsonString);
//                 console.log('[stream-chat] Final JSON data:', jsonData);
//                 if (jsonData.answer) {
//                   result += jsonData.answer;
//                 } else {
//                   console.warn('[stream-chat] No "answer" found in final JSON data.');
//                 }
//               } catch (err) {
//                 console.error('Error parsing final JSON:', err);
//               }
//             }
//           }
//           resolve(result);
//         });

//         response.on('error', (err) => {
//           console.error('Response error:', err);
//           reject(err);
//         });
//       });

//       reqPost.on('error', (err) => {
//         console.error('Request error:', err);
//         reject(err);
//       });

//       // Gửi dữ liệu
//       reqPost.write(postData);
//       reqPost.end();
//     });

//     console.log(`[stream-chat] Final result: ${finalResult}`);
//     // Gửi kết quả về cho client
//     res.json({ result: finalResult });
//   } catch (error) {
//     console.error('Error calling the API:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// ============================================================

// Chạy được ngon lành, chỉ không render được lên box chat

// Route /chat
app.post('/chat', async (req, res) => {
  console.log('[Backend] /chat endpoint called');

  const apiKey = 'app-8ckxe8hAmEWliJVwVlw5zLDj';
  const url = 'http://103.75.180.15/v1/chat-messages';

  const { message } = req.body;
  console.log(`[Backend] Parsed message: "${message}"`);

  if (!message) {
    console.error('[Backend] Missing "message" in the request body.');
    return res.status(400).json({ error: 'Missing "message" in the request body.' });
  }

  const data = {
    inputs: {
      file_name: "abc.csv",
      file_type: "csv",
      chunk_id: "kjajakjdkjakakda"
    },
    query: message,
    response_mode: "streaming",
    conversation_id: "",
    user: "abc-123",
    files: [
      {
        type: "image",
        transfer_method: "remote_url",
        url: "https://cloud.dify.ai/logo/logo-site.png"
      }
    ]
  };

  const postData = JSON.stringify(data);
  console.log(`[Backend] Sending data to external API: ${postData}`);

  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 80,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const finalResult = await new Promise((resolve, reject) => {
      const reqPost = http.request(options, (response) => {
        let buffer = '';
        let finalResult = '';

        console.log(`[Backend] External API responded with status: ${response.statusCode}`);

        response.on('data', (chunk) => {
          const chunkStr = chunk.toString('utf-8');
          buffer += chunkStr;

          let lines = buffer.split('\n');
          // Giữ lại phần cuối chưa hoàn chỉnh
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('data:')) {
              const jsonString = line.replace(/^data:\s*/, '');
              if (jsonString === '[DONE]') {
                response.destroy(); // Kết thúc stream
                resolve(finalResult);
                return;
              }
              try {
                const jsonData = JSON.parse(jsonString);
                if (jsonData.answer) {
                  finalResult += jsonData.answer;
                }
              } catch (err) {
                console.error('Error parsing JSON:', err);
              }
            }
          }
        });

        response.on('end', () => {
          // Xử lý phần còn lại trong buffer
          if (buffer.startsWith('data:')) {
            const jsonString = buffer.replace(/^data:\s*/, '');
            if (jsonString !== '[DONE]') {
              try {
                const jsonData = JSON.parse(jsonString);
                if (jsonData.answer) {
                  finalResult += jsonData.answer;
                }
              } catch (err) {
                console.error('Error parsing JSON:', err);
              }
            }
          }
          resolve(finalResult);
        });

        response.on('error', (err) => {
          console.error('[Backend] Response error from external API:', err);
          reject(err);
        });
      });

      reqPost.on('error', (err) => {
        console.error('[Backend] Request error to external API:', err);
        reject(err);
      });

      // Thêm timeout (ví dụ 10 giây)
      reqPost.setTimeout(10000, () => {
        console.error('[Backend] External API request timed out');
        reqPost.abort();
        reject(new Error('External API request timed out'));
      });

      reqPost.write(postData);
      reqPost.end();
    });

    const responseBody = {
      id: uuidv4(), // Tạo id mới
      type: "message",
      textResponse: finalResult,
      sources: [],
      close: false,
      error: null
    };

    res.json(responseBody);
    console.log(`[Backend] Responded with:`, responseBody);
  } catch (error) {
    console.error('[Backend] Error calling the external API:', error);
    const errorResponse = {
      id: uuidv4(),
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: 'Internal Server Error'
    };
    res.status(500).json(errorResponse);
    console.log(`[Backend] Responded with error:`, errorResponse);
  }
});

// ============================================================

}

module.exports = { chatEndpoints };


