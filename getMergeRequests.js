const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const { GITLAB_URL, PRIVATE_TOKEN, PROJECT_ID, ELIGIBLE_USERS } = process.env;
let mrs = [];
const lastDays = 2;
const eligibleUsers = ELIGIBLE_USERS.split(",");

const getMergeRequests = async (page = 1, mergeRequests = []) => {
  try {
    const response = await axios.get(
      `${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests`,
      {
        headers: {
          "Private-Token": PRIVATE_TOKEN,
        },
        params: {
          state: "merged",
          per_page: 100,
          page: page,
          updated_after: new Date(
            new Date().setDate(new Date().getDate() - lastDays)
          ).toISOString(),
          //   updated_after: new Date(
          //     new Date().setMonth(new Date().getWeek() - 1)
          //   ).toISOString(),
        },
      }
    );

    mergeRequests = mergeRequests.concat(response.data);

    if (response.data.length === 100) {
      return await getMergeRequests(page + 1, mergeRequests);
    }

    return mergeRequests;
  } catch (error) {
    console.error(
      "Ошибка при получении Merge Requests:",
      error.response ? error.response.data : error.message
    );
    return undefined;
  }
};
const getNotesForMergeRequest = async (mergeRequest) => {
  try {
    const response = await axios.get(
      `${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${mergeRequest.iid}/notes`,
      {
        headers: {
          "Private-Token": PRIVATE_TOKEN,
        },
      }
    );
    return response.data.filter((note) => !note.system);
  } catch (error) {
    console.error(
      `Ошибка при получении одобрений для Merge Request ${mergeRequestId}:`,
      error.response ? error.response.data : error.message
    );
    return [];
  }
};

const getApprovalsForMergeRequest = async (mergeRequest) => {
  try {
    const response = await axios.get(
      `${GITLAB_URL}/api/v4/projects/${PROJECT_ID}/merge_requests/${mergeRequest.iid}/approvals`,
      {
        headers: {
          "Private-Token": PRIVATE_TOKEN,
        },
      }
    );
    const notes = await getNotesForMergeRequest(mergeRequest);

    mrs.push({
      id: mergeRequest.iid,
      url: mergeRequest.web_url,
      title: mergeRequest.title,
      author: mergeRequest.author.username,
      approvers: response.data.approved_by.map((user) => user.user.username),
      notes: {
        all: notes.map((note) => ({
          body: note.body,
          author: note.author.username,
        })),
        eligible: notes.filter((note) =>
          eligibleUsers.includes(note.author.username)
        ),
        author: notes.filter(
          (note) => note.author.id === mergeRequest.author.id
        ),
      },
    });

    return response.data.approved_by || [];
  } catch (error) {
    console.error(
      `Ошибка при получении одобрений для Merge Request ${mergeRequest.iid}:`,
      error.response ? error.response.data : error.message
    );
    return [];
  }
};

const countApprovalsByUsers = async (mergeRequests) => {
  const approvalCounts = {};

  eligibleUsers.forEach((user) => {
    approvalCounts[user] = 0;
  });

  const approvalPromises = mergeRequests.map(async (mergeRequest) => {
    const approvals = await getApprovalsForMergeRequest(mergeRequest);
    approvals.forEach((approval) => {
      if (
        approval.user &&
        approvalCounts.hasOwnProperty(approval.user.username)
      ) {
        approvalCounts[approval.user.username] += 1;
      }
    });
  });

  await Promise.all(approvalPromises);

  return approvalCounts;
};

const generateReport = () => {
  let report = "";
  mrs.forEach(
    (mr) =>
      (report += `${mr.title} ${mr.url}\n Notes count: ${mr.notes.all.length}, from eligible: ${mr.notes.eligible.length}\n Approvers:${mr.approvers}\n\n`)
  );
  return report;
};

const main = async () => {
  const mergeRequests = await getMergeRequests();
  console.log(
    `Всего Merge Requests за последние ${lastDays} дней: ${mergeRequests.length}`
  );
  if (mergeRequests) {
    const approvalCounts = await countApprovalsByUsers(mergeRequests);

    console.log("Количество аппрувов для каждого пользователя:");
    for (const user in approvalCounts) {
      console.log(`${user}: ${approvalCounts[user]}`);
    }
  } else {
    console.log("Не удалось получить Merge Requests.");
  }
  const mrsWithNotes = mrs.filter((mr) => mr.notes?.all?.length > 0);
  const mrsWithNotesFromEligible = mrsWithNotes.filter(
    (mr) => mr.notes.eligible?.length > 0
  );
  console.log(
    `Из ${mrs.length} MRов: ${mrsWithNotes.length} с комментариями, из которых: ${mrsWithNotesFromEligible.length} от ответственных`
  );
  const report = generateReport();
  fs.writeFile("fullReport.txt", report, (err) => {
    if (err) {
      console.error("Ошибка при записи в файл:", err);
    } else {
      console.log("Отчет успешно записан в fullReport.txt");
    }
  });
};

main();
