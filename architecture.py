from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import CloudFront, APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.compute import Lambda
from diagrams.aws.database import DynamoDB
from diagrams.aws.security import Cognito
from diagrams.aws.integration import Eventbridge
from diagrams.aws.general import Users

with Diagram("Digital Fatigue Management App - AWS Architecture", show=False, direction="LR", filename="aws_architecture"):

    users = Users("사용자\n(React PWA)")

    with Cluster("AWS Cloud"):

        cf = CloudFront("CloudFront\n(CDN)")
        s3 = S3("S3 Bucket\n(정적 호스팅)")

        apigw = APIGateway("API Gateway\n(REST API)")
        cognito = Cognito("Cognito\n(인증/인가)")

        with Cluster("Lambda Functions"):
            auth_fn = Lambda("auth-fn\n회원가입/로그인")
            symptom_fn = Lambda("symptom-fn\n피로증상 CRUD")
            screentime_fn = Lambda("screentime-fn\n스크린타임 기록")
            analysis_fn = Lambda("analysis-fn\n주간분석/점수")
            ranking_fn = Lambda("ranking-fn\n사용자 랭킹")

        eventbridge = Eventbridge("EventBridge\n(주간 스케줄)")

        with Cluster("DynamoDB Tables"):
            users_table = DynamoDB("Users")
            symptoms_table = DynamoDB("SymptomLogs")
            screentime_table = DynamoDB("ScreenTime")
            analysis_table = DynamoDB("WeeklyAnalysis")
            ranking_table = DynamoDB("Rankings")

    # 흐름 연결
    users >> Edge(label="HTTPS") >> cf
    cf >> Edge(label="정적 파일") >> s3
    cf >> Edge(label="/api/*") >> apigw
    apigw >> Edge(label="JWT 검증") >> cognito

    apigw >> auth_fn
    apigw >> symptom_fn
    apigw >> screentime_fn
    apigw >> analysis_fn
    apigw >> ranking_fn

    eventbridge >> Edge(label="매주 월요일") >> analysis_fn
    eventbridge >> ranking_fn

    auth_fn >> users_table
    symptom_fn >> symptoms_table
    screentime_fn >> screentime_table
    analysis_fn >> analysis_table
    ranking_fn >> ranking_table
