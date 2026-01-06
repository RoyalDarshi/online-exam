import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

export let options = {
  stages: [
    { duration: "30s", target: 500 },
    { duration: "30s", target: 1000 },
    { duration: "30s", target: 1500 },
    { duration: "30s", target: 2000 },
    { duration: "2m", target: 2000 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<700"], // realistic
  },
};

const BASE_URL = "http://localhost:8080";
const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNzQyOGQ4YS0wZTE2LTQ4NTYtOTRmNS03YWU5NzljNjA5MDgiLCJyb2xlIjoic3R1ZGVudCIsImV4cCI6MTc2Njc1NzczNywiaWF0IjoxNzY2NDk4NTM3LCJqdGkiOiJkNmU2MzJiMi05NjM4LTRjODMtOGIyNi0zM2UxZTVkYjAzOGEifQ.k9MgT8y7RxGmn8FlpmaIuZ6f-6m36cglKKry6tks4ZA"; // injected token

const autosaveTrend = new Trend("autosave_latency");

export default function () {
  if (!TOKEN) {
    throw new Error("EXAM_TOKEN env var not set");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  // 1️⃣ GET EXAMS
  const examsRes = http.get(`${BASE_URL}/api/exams`, { headers });
  check(examsRes, { "exams ok": (r) => r.status === 200 });

  const exams = examsRes.json();
  if (!exams || exams.length === 0) return;

  const examId = exams[0].id;

  // 2️⃣ START ATTEMPT
  const startRes = http.post(
    `${BASE_URL}/api/attempts/start`,
    JSON.stringify({ exam_id: examId }),
    { headers }
  );

  if (startRes.status !== 200) return;
  const attemptId = startRes.json("id");

  // 3️⃣ AUTOSAVE
  for (let i = 0; i < 5; i++) {
    const res = http.post(
      `${BASE_URL}/api/progress`,
      JSON.stringify({
        attempt_id: attemptId,
        answers: { q1: "A" },
        tab_switches: 0,
      }),
      { headers }
    );

    autosaveTrend.add(res.timings.duration);
    sleep(1 + Math.random() * 2);
  }

  // 4️⃣ SUBMIT
  http.post(
    `${BASE_URL}/api/attempts/submit`,
    JSON.stringify({ attempt_id: attemptId }),
    { headers }
  );

  sleep(1);
}
