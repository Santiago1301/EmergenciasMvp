# Build desde la RAIZ del monorepo:
#   docker build -f services/s4-notification/Dockerfile -t s4-notification .
# CMD apunta a lambda_handler (no a Mangum): en produccion este servicio lo
# invoca EventBridge directamente, no API Gateway.

FROM public.ecr.aws/lambda/python:3.12 AS build
WORKDIR /build
COPY libs/emergencias_common ./libs/emergencias_common
COPY services/s4-notification/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /opt/python && \
    pip install --no-cache-dir ./libs/emergencias_common --target /opt/python

FROM public.ecr.aws/lambda/python:3.12
COPY --from=build /opt/python ${LAMBDA_TASK_ROOT}
COPY services/s4-notification/app ${LAMBDA_TASK_ROOT}/app
CMD ["app.main.lambda_handler"]
