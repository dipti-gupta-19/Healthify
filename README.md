# Healthify 🏥

Healthify is a modern, full-stack Next.js web application integrating cutting-edge AI vision models with a highly available, auto-scaling AWS cloud architecture. 

## 🚀 Cloud Infrastructure & Architecture

This project was built with a strong focus on Cloud Engineering best practices, utilizing a fully automated CI/CD pipeline and highly available infrastructure on Amazon Web Services (AWS).

- **Hosting:** AWS Elastic Beanstalk
- **Containerization:** Docker & Amazon Elastic Container Registry (ECR)
- **CI/CD Pipeline:** AWS CodePipeline & AWS CodeBuild
- **High Availability:** Application Load Balancer (ALB) with Auto Scaling Groups (ASG)
- **Security:** Strict IAM Role policies (`AmazonEC2ContainerRegistryReadOnly`) for least-privilege access.

### The CI/CD Workflow
1. Code changes are pushed to the `main` branch on GitHub.
2. **AWS CodePipeline** intercepts the webhook and triggers **AWS CodeBuild**.
3. CodeBuild provisions an isolated Linux environment, securely authenticates with AWS ECR, and builds the Docker image.
4. The Docker image is uniquely tagged with the Git commit hash and pushed to **Amazon ECR**.
5. CodeBuild dynamically generates a `Dockerrun.aws.json` artifact pointing to the exact newly pushed image.
6. **AWS Elastic Beanstalk** consumes the artifact, gracefully pulls the new image from ECR, and orchestrates a zero-downtime deployment to the EC2 instances in the Auto Scaling Group.

## 🛠️ Tech Stack

- **Frontend:** Next.js (React)
- **Backend:** Next.js API Routes (Node.js)
- **Database:** MongoDB
- **AI Integration:** Google Gemini Vision API (with HuggingFace fallback)
- **DevOps:** Docker, AWS (CodePipeline, CodeBuild, ECR, Elastic Beanstalk, IAM)

## 💻 Local Development

### Prerequisites
- Node.js 18+
- Docker Desktop
- MongoDB Database
- Gemini API Key

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/dipti-gupta-19/Healthify.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB=healthify
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Running Locally with Docker
You can mirror the production environment by running the app in a local Docker container:
```bash
docker build -t healthify .
docker run -p 3000:3000 --env-file .env healthify
```
