#!/bin/bash
# Boost Deployment Script
# Usage: ./scripts/deploy.sh [api|web|all]

set -e

PROJECT_ID="${PROJECT_ID:-boost-dev-3fabf}"
REGION="${REGION:-us-central1}"
API_URL="${API_URL:-}"

deploy_api() {
    echo "Deploying API to Cloud Run..."
    cd apps/api
    
    # Build and push image
    gcloud builds submit --tag gcr.io/$PROJECT_ID/boost-api
    
    # Deploy to Cloud Run
    gcloud run deploy boost-api \
        --image gcr.io/$PROJECT_ID/boost-api \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars "CORS_ORIGINS=https://boost-dev-3fabf.web.app,https://$PROJECT_ID.web.app"
    
    # Get the service URL
    API_URL=$(gcloud run services describe boost-api --region $REGION --format 'value(status.url)')
    echo "API deployed to: $API_URL"
    
    cd ../..
}

deploy_web() {
    echo "Deploying frontend to Firebase Hosting..."
    cd apps/web
    
    # Set API URL if provided
    if [ -n "$API_URL" ]; then
        echo "NEXT_PUBLIC_API_URL=$API_URL" > .env.production.local
    fi
    
    # Build the app
    npm run build
    
    # Deploy to Firebase
    npx firebase deploy --only hosting
    
    cd ../..
    echo "Frontend deployed!"
}

case "${1:-all}" in
    api)
        deploy_api
        ;;
    web)
        deploy_web
        ;;
    all)
        deploy_api
        deploy_web
        ;;
    *)
        echo "Usage: $0 [api|web|all]"
        exit 1
        ;;
esac

echo "Deployment complete!"
