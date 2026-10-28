# ForFor 학사 내비 (Vite)

보내준 HTML 프로토타입을 화면·동작 그대로 Vite 프로젝트로 옮긴 거예요.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # dist/ 생성

## 구조
- `index.html`: 뼈대(rail + 폰 화면)
- `src/style.css`: 스타일 (색 변수는 맨 위 :root)
- `src/data.js`: 데모 데이터 (일정, 과목, 게시글, FAQ …)
- `src/main.js`: 상태, 화면 렌더링, 이벤트

## Vercel
GitHub에 올린 뒤 vercel.com에서 저장소를 Import하면 Vite로 자동 인식돼요. 설정은 그대로 Deploy.
